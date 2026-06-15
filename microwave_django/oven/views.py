import json
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt

from .simulation import oven


def index(request):
    return render(request, 'oven/index.html')


@require_GET
def status(request):
    return JsonResponse(oven.get_status())


@csrf_exempt
@require_POST
def action(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        body = {}

    act = body.get('action', '')

    if act == 'power_on':
        oven.power_on()
    elif act == 'power_off':
        oven.power_off()
    elif act == 'open_door':
        oven.open_door()
    elif act == 'close_door':
        oven.close_door()
    elif act == 'start_cooking':
        cook_time = int(body.get('cook_time', 60))
        power_level = int(body.get('power_level', 100))
        oven.start_cooking(cook_time, power_level)
    elif act == 'cancel':
        oven.cancel()
    elif act == 'acknowledge_done':
        oven.acknowledge_done()
    else:
        return JsonResponse({'error': f'Unknown action: {act}'}, status=400)

    return JsonResponse(oven.get_status())
