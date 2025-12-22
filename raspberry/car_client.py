import asyncio
import websockets
import json
import RPi.GPIO as GPIO # Assuming RPi.GPIO is installed on the Pi

# GPIO Setup
GPIO.setmode(GPIO.BCM)
# Example Pins
IN1 = 17
IN2 = 18
IN3 = 22
IN4 = 23
GPIO.setup([IN1, IN2, IN3, IN4], GPIO.OUT)

RASPBERRY_ID = "pi_car_01"
SERVER_URL = f"ws://YOUR_SERVER_IP:8000/api/ws/car/{RASPBERRY_ID}"

def stop_motors():
    GPIO.output([IN1, IN2, IN3, IN4], False)

def move_forward():
    GPIO.output(IN1, True)
    GPIO.output(IN2, False)
    GPIO.output(IN3, True)
    GPIO.output(IN4, False)

def move_backward():
    GPIO.output(IN1, False)
    GPIO.output(IN2, True)
    GPIO.output(IN3, False)
    GPIO.output(IN4, True)

def move_left():
    GPIO.output(IN1, True) # Left forward
    # Right stopped/back
    GPIO.output(IN3, False)

def move_right():
    GPIO.output(IN3, True)
    GPIO.output(IN1, False)

# Process management
import subprocess
import signal
import os

browser_process = None

def start_stream(vdo_id):
    global browser_process
    if browser_process:
        print("Stream already running")
        return

    url = f"https://vdo.ninja/?push={vdo_id}&autostart&stereo&proaudio"
    print(f"Starting Stream to {url}")
    
    # Launch Chromium in Kiosk mode
    # --use-fake-ui-for-media-stream avoids permission prompts
    cmd = [
        "chromium-browser",
        "--kiosk",
        "--use-fake-ui-for-media-stream", 
        "--user-data-dir=/tmp/chromium_car",
        url
    ]
    
    try:
        browser_process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"Browser PID: {browser_process.pid}")
    except FileNotFoundError:
        print("Chromium not found! Is it installed?")

def stop_stream():
    global browser_process
    if browser_process:
        print("Stopping Stream...")
        try:
            # Gentle kill
            browser_process.terminate()
            browser_process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            browser_process.kill()
        except Exception as e:
            print(f"Error killing browser: {e}")
        
        browser_process = None
    else:
        print("No stream to stop")

async def send_telemetry(websocket):
    import random
    while True:
        try:
            # Simulate sensor data
            battery = 85 + random.randint(-2, 2)
            rssi = -40 + random.randint(-10, 10)
            
            telemetry = {
                "type": "telemetry",
                "battery": battery,
                "rssi": rssi,
                "cpu_temp": 45.0
            }
            await websocket.send(json.dumps(telemetry))
            await asyncio.sleep(5) # Every 5 seconds
        except Exception as e:
            print(f"Telemetry Error: {e}")
            break

async def run_car():
    print(f"Connecting to {SERVER_URL}...")
    async with websockets.connect(SERVER_URL) as websocket:
        print("Connected!")
        # Start telemetry task
        asyncio.create_task(send_telemetry(websocket))
        
        while True:
            command = await websocket.recv()
            print(f"Command: {command}")
            
            if command.startswith("start_stream"):
                _, vdo_id = command.split("|")
                start_stream(vdo_id)
            elif command == "stop_stream":
                stop_stream()
            elif command == "forward": move_forward()
            elif command == "backward": move_backward()
            elif command == "left": move_left()
            elif command == "right": move_right()
            elif command == "stop": stop_motors()
            elif command.startswith("cam_"):
                print(f"Camera Servo Command: {command}")
                # TODO: Implement servo logic here
            else: print("Unknown command")

if __name__ == "__main__":
    try:
        asyncio.run(run_car())
    except KeyboardInterrupt:
        stop_motors()
        GPIO.cleanup()
