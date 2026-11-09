import struct
import subprocess
import time
import os
from pydub import AudioSegment

# Mock or external emulator interface reference (replace with actual 'emu'/'android' objects)
# import emu
# import android

# App and ROM memory definitions
currentRom = "languages"
currentApp = None
appProcess = None

audioRenderJobAddr = 0x00000000
audioRenderJobAddrlanguages = 0x00AF340D
textDataAddrlanguages = audioRenderJobAddrlanguages + 0x349

# Struct definition representing the job memory layout
# Format: 8 Unsigned Bytes, 1 Signed Int, 1 Unsigned Int, 1 Signed Int, 2 Unsigned Bytes
structDef = "BBBBBBBBBiIiBB"

def getJobAddr():
    """Returns the base memory address for the TTS job based on current ROM."""
    if currentRom == "languages":
        return audioRenderJobAddrlanguages
    return audioRenderJobAddr

def readJob():
    """Reads and unpacks the job structure from memory."""
    structSize = struct.calcsize(structDef)
    data = emu.read_memory(getJobAddr(), structSize)
    unpacked = struct.unpack(structDef, data)
    return {
        "status": unpacked[0],
        "stretch": unpacked[1],
        "pitch": unpacked[2],
        "speed": unpacked[3],
        "depth": unpacked[4],
        "energy": unpacked[5],
        "accent": unpacked[6],
        "delivery": unpacked[7],
        "audioSize": unpacked[8],
        "audioData": unpacked[9],
        "allocatedSize": unpacked[10],
        "language": unpacked[11],
        "speechDataSize": unpacked[12] if len(unpacked) > 12 else 0
    }

def writeJobRaw(job, speechData=None):
    """Packs and writes the job structure (and optional speech data) to memory."""
    structSize = struct.calcsize(structDef)
    data = struct.pack(
        structDef,
        job["status"],
        job.get("stretch", 0),
        job["pitch"],
        job["speed"],
        job["depth"],
        job["energy"],
        job["accent"],
        job["delivery"],
        job["audioSize"],
        job["audioData"],
        job["allocatedSize"],
        job["language"],
        job.get("speechDataSize", 0)
    )
    emu.write_memory(getJobAddr(), data)
    if speechData is not None:
        emu.write_memory(getJobAddr() + structSize + 1, speechData)

def calcFileLength(audio_bytes, sample_rate=16000, channels=1, bytes_per_sample=2):
    """Calculates audio duration in seconds based on byte length."""
    return len(audio_bytes) / (sample_rate * channels * bytes_per_sample)

def waitForStatus(stat, timeout=15, setLanguage=None):
    """Polls memory until the status code matches expected target state."""
    current = -1
    start_time = time.time()
    while current != stat:
        if setLanguage is not None:
            job = readJob()
            job["language"] = setLanguage
            writeJobRaw(job)
        time.sleep(0.1)
        current = emu.read_memory(getJobAddr(), 1)[0]
        if time.time() - start_time > timeout:
            raise TimeoutError(f"Timed out waiting for status {stat}")

def setApp(name):
    """Sets current active app context."""
    global currentApp
    currentApp = name

def startApp(appname, romname, setLanguage=None):
    """Initializes app directories and launches target process inside emulator."""
    global appProcess, currentApp
    setApp(appname)
    
    # Create /tmp/user configuration directory if non-existent
    target_dir = "/tmp/user/config"
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)
        if os.path.exists("/config/sdl2-config.ini"):
            with open("/config/sdl2-config.ini", "rb") as f_in:
                with open(os.path.join(target_dir, "sdl2-config.ini"), "wb") as f_out:
                    f_out.write(f_in.read())
                    
    appProcess = subprocess.Popen(
        ["timeout", "60s", "android", f"/opt/{romname}.cxi", "-u", str(android.ANDROID_PORT)],
        cwd="/tmp"
    )
    
    connected = False
    while not connected:
        try:
            waitForStatus(1, setLanguage=setLanguage)
            connected = True
        except TimeoutError:
            pass

def appEmulator():
    """Terminates running app process."""
    global appProcess
    if appProcess is not None:
        appProcess.kill()
        appProcess.wait()
        appProcess = None

def writeJob(pitch, speed, depth, energy, accent, delivery, speechData, language):
    """Helper function to format and execute writeJobRaw."""
    job = {
        "status": 1,
        "pitch": pitch,
        "speed": speed,
        "depth": depth,
        "energy": energy,
        "accent": accent,
        "delivery": delivery,
        "audioSize": 0,
        "audioData": 0,
        "allocatedSize": 0,
        "language": language,
        "speechDataSize": len(speechData) if speechData is not None else 0
    }
    writeJobRaw(job, speechData)

def convertDataToWav(data):
    """Converts raw 16-bit PCM mono data to WAV format using AudioSegment."""
    sRate = 16000
    if currentApp == "language":
        sRate = 0x58EF  # ~22767 Hz
    
    # Signed 16-bit PCM, mono -> export WAV
    audio = AudioSegment(data, sample_width=2, frame_rate=sRate, channels=1)
    return audio.export(format="wav").read()

def readDebugData():
    """Reads UTF-16LE formatted debug logs from memory."""
    debugLoc = 0x004110F0
    debugSize = int.from_bytes(emu.read_memory(debugLoc, 4), "little")
    debugData = emu.read_memory(debugLoc + 4, debugSize)
    text = debugData.decode('utf-16le').replace("\x1b", "*")
    print("Debug data: " + text)

def readRenderedAudio(timeout=15, chunk_size=None):
    """Reads rendered raw audio chunk-by-chunk from allocated memory address."""
    if chunk_size is None:
        chunk_size = getattr(android, "MAX_REQUEST_DATA_SIZE", 4096)
        
    start_time = time.time()
    job = readJob()
    
    if job["audioSize"] <= 0 or job["audioData"] == 0:
        return None
    
    total_size = job["audioSize"]
    address = job["audioData"]
    data = b""
    bytes_read = 0
    
    while bytes_read < total_size:
        if time.time() - start_time > timeout:
            raise TimeoutError(f"Timeout reading audio data after {bytes_read}/{total_size} bytes")
        
        remaining = total_size - bytes_read
        current_chunk_size = min(chunk_size, remaining)
        
        chunk = emu.read_memory(address + bytes_read, current_chunk_size)
        data += chunk
        bytes_read += len(chunk)
    
    return data
