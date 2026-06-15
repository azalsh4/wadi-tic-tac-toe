import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchStatus, sendAction, OvenStatus, OvenState } from './api';

const { width } = Dimensions.get('window');

interface LogEntry {
  id: number;
  ts: string;
  msg: string;
  isChange: boolean;
}

const INITIAL_STATUS: OvenStatus = {
  display: '…',
  oven_state: 'Off',
  door_state: 'Closed',
  timer_state: 'Inactive',
  timer_remaining: 0,
  magnetron_state: 'Off',
  magnetron_power: 0,
  cook_time: 0,
  power_level: 0,
  beeping: false,
};

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export default function App() {
  const [status, setStatus] = useState<OvenStatus>(INITIAL_STATUS);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [cookSecs, setCookSecs] = useState('30');
  const [cookPower, setCookPower] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const logId = useRef(0);
  const prevStatus = useRef<OvenStatus>(INITIAL_STATUS);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const addLog = useCallback((msg: string, isChange = false) => {
    setLog(prev => [
      { id: logId.current++, ts: now(), msg, isChange },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const applyStatus = useCallback((s: OvenStatus) => {
    const prev = prevStatus.current;
    if (prev.oven_state !== s.oven_state) {
      addLog(`State: ${prev.oven_state} → ${s.oven_state}`, true);
    }
    if (prev.door_state !== s.door_state) {
      addLog(`Door: ${prev.door_state} → ${s.door_state}`);
    }
    prevStatus.current = s;
    setStatus(s);
    setError(null);
  }, [addLog]);

  // Pulse animation while beeping
  useEffect(() => {
    if (status.beeping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.2, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [status.beeping, pulseAnim]);

  // Initial load + 1-second poll for live timer countdown
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const s = await fetchStatus();
        if (!cancelled) applyStatus(s);
      } catch {
        if (!cancelled) setError('Cannot reach server — check Django is running');
      }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [applyStatus]);

  const action = useCallback(async (act: string, extras?: Record<string, unknown>) => {
    try {
      const s = await sendAction(act, extras);
      applyStatus(s);
    } catch {
      setError('Action failed — check Django is running');
    }
  }, [applyStatus]);

  const { oven_state: st, door_state: doorState } = status;

  const displayColor = st === 'Done'
    ? '#fbbf24'
    : st === 'Off'
      ? '#475569'
      : '#22d3ee';

  const remaining = status.timer_remaining;
  const remStr = remaining > 0
    ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
    : '—';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title}>MICROWAVE OVEN</Text>

          {error && <Text style={s.error}>{error}</Text>}

          {status.beeping && (
            <Animated.View style={[s.beeper, { opacity: pulseAnim }]}>
              <Text style={s.beeperText}>🔔  BEEP! BEEP! BEEP!</Text>
            </Animated.View>
          )}

          {/* Display panel */}
          <View style={s.panel}>
            <Text style={[s.displayText, { color: displayColor }]}>
              {status.display}
            </Text>
            <View style={s.statsRow}>
              <StatCell label="Timer"     value={status.timer_state} />
              <StatCell label="Remaining" value={remStr} />
              <StatCell label="Magnetron" value={`${status.magnetron_state}${status.magnetron_power ? ` (${status.magnetron_power}%)` : ''}`} />
              <StatCell label="Power set" value={status.power_level ? `${status.power_level}%` : '—'} />
            </View>
          </View>

          {/* Badges */}
          <View style={s.badges}>
            <Badge label={st}                       extraStyle={ovenBadgeStyle(st)} />
            <Badge label={`Door: ${doorState}`}     extraStyle={doorState === 'Open' ? s.badgeDanger : undefined} />
            <Badge label={`Magnetron: ${status.magnetron_state}`} extraStyle={status.magnetron_state === 'On' ? s.badgeGreen : undefined} />
          </View>

          {/* Power */}
          <Section title="Power">
            <View style={s.btnRow}>
              <Btn label="Power On"  variant="primary" disabled={st !== 'Off'}  onPress={() => action('power_on')} />
              <Btn label="Power Off" variant="danger"  disabled={st !== 'Idle'} onPress={() => action('power_off')} />
            </View>
          </Section>

          {/* Door */}
          <Section title="Door">
            <View style={s.btnRow}>
              <Btn label="Open Door"  disabled={doorState === 'Open' || st === 'Off'} onPress={() => action('open_door')} />
              <Btn label="Close Door" disabled={doorState === 'Closed'}               onPress={() => action('close_door')} />
            </View>
          </Section>

          {/* Cook */}
          <Section title="Cook">
            <View style={s.cookRow}>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Seconds</Text>
                <TextInput
                  style={s.input}
                  keyboardType="number-pad"
                  value={cookSecs}
                  onChangeText={setCookSecs}
                  placeholderTextColor="#475569"
                />
              </View>
              <View style={s.field}>
                <Text style={s.fieldLabel}>Power %</Text>
                <TextInput
                  style={s.input}
                  keyboardType="number-pad"
                  value={cookPower}
                  onChangeText={setCookPower}
                  placeholderTextColor="#475569"
                />
              </View>
              <Btn
                label="Start"
                variant="primary"
                style={{ flex: 0, paddingHorizontal: 20, alignSelf: 'flex-end' }}
                disabled={st !== 'Idle'}
                onPress={() => {
                  const secs = parseInt(cookSecs, 10) || 30;
                  const pwr = Math.min(100, Math.max(1, parseInt(cookPower, 10) || 100));
                  action('start_cooking', { cook_time: secs, power_level: pwr });
                }}
              />
            </View>
          </Section>

          {/* Controls */}
          <Section title="Controls">
            <View style={s.btnRow}>
              <Btn label="Cancel"           variant="danger" disabled={!['Cooking', 'Paused'].includes(st)} onPress={() => action('cancel')} />
              <Btn label="Acknowledge Done"                  disabled={st !== 'Done'}                        onPress={() => action('acknowledge_done')} />
            </View>
          </Section>

          {/* Event log */}
          <Section title="Event Log">
            <View style={s.logBox}>
              {log.length === 0
                ? <Text style={s.logEmpty}>No events yet.</Text>
                : log.map(entry => (
                    <View key={entry.id} style={s.logEntry}>
                      <Text style={s.logTs}>[{entry.ts}] </Text>
                      <Text style={[s.logMsg, entry.isChange && s.logChange]}>{entry.msg}</Text>
                    </View>
                  ))
              }
            </View>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statCell}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Badge({ label, extraStyle }: { label: string; extraStyle?: object }) {
  return (
    <View style={[s.badge, extraStyle]}>
      <Text style={s.badgeText}>{label}</Text>
    </View>
  );
}

type BtnVariant = 'default' | 'primary' | 'danger';

function Btn({
  label, onPress, disabled, variant = 'default', style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: BtnVariant;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[
        s.btn,
        variant === 'primary' ? s.btnPrimary : variant === 'danger' ? s.btnDanger : s.btnDefault,
        disabled && s.btnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[
        s.btnText,
        variant === 'primary' && s.btnTextPrimary,
        variant === 'danger'  && s.btnTextDanger,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ovenBadgeStyle(st: OvenState): object | undefined {
  if (st === 'Cooking')  return s.badgeGreen;
  if (st === 'Done')     return s.badgeYellow;
  if (st === 'Paused')   return s.badgePurple;
  return undefined;
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 40 },

  title: {
    color: '#64748b', fontSize: 12, fontWeight: '700',
    letterSpacing: 3, textAlign: 'center', marginBottom: 16,
  },
  error: {
    color: '#f87171', fontSize: 12, textAlign: 'center',
    backgroundColor: '#450a0a', borderRadius: 6,
    padding: 8, marginBottom: 12,
  },
  beeper: {
    backgroundColor: '#7f1d1d', borderWidth: 1, borderColor: '#ef4444',
    borderRadius: 10, padding: 14, marginBottom: 12, alignItems: 'center',
  },
  beeperText: {
    color: '#fca5a5', fontSize: 18, fontWeight: '800', letterSpacing: 2,
  },

  panel: {
    backgroundColor: '#020617', borderWidth: 1, borderColor: '#1e3a5f',
    borderRadius: 12, padding: 16, marginBottom: 12,
  },
  displayText: {
    fontSize: 48,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    textAlign: 'center', letterSpacing: 4,
    marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e3a5f',
  },
  statsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell:  { width: (width - 64) / 2 },
  statLabel: { fontSize: 10, color: '#475569', marginBottom: 1 },
  statValue: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  badge:     { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeGreen:  { borderColor: '#16a34a', backgroundColor: '#052e16' },
  badgeDanger: { borderColor: '#dc2626', backgroundColor: '#450a0a' },
  badgeYellow: { borderColor: '#ca8a04', backgroundColor: '#1c1917' },
  badgePurple: { borderColor: '#6d28d9', backgroundColor: '#1e1b4b' },

  section:      { marginBottom: 14 },
  sectionTitle: { fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontWeight: '700' },

  btnRow:        { flexDirection: 'row', gap: 8 },
  btn:           { flex: 1, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnDefault:    { borderColor: '#334155', backgroundColor: '#1e293b' },
  btnPrimary:    { borderColor: '#1d4ed8', backgroundColor: '#172554' },
  btnDanger:     { borderColor: '#7f1d1d', backgroundColor: '#1c0a0a' },
  btnDisabled:   { opacity: 0.3 },
  btnText:       { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  btnTextPrimary:{ color: '#60a5fa' },
  btnTextDanger: { color: '#f87171' },

  cookRow:    { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  field:      { flex: 1 },
  fieldLabel: { fontSize: 10, color: '#475569', marginBottom: 4 },
  input: {
    backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155',
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
    color: '#e2e8f0', fontSize: 15, fontWeight: '600',
  },

  logBox:   { backgroundColor: '#020617', borderWidth: 1, borderColor: '#1e293b', borderRadius: 8, padding: 10, maxHeight: 160 },
  logEmpty: { color: '#334155', fontSize: 11, fontStyle: 'italic' },
  logEntry: { flexDirection: 'row', marginBottom: 3 },
  logTs:    { fontSize: 10, color: '#334155', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  logMsg:   { fontSize: 10, color: '#64748b', flex: 1, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  logChange:{ color: '#22d3ee' },
});
