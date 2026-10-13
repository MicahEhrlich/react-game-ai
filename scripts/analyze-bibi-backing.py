"""Analyze the reference only; never copy it into the game's assets.

Optional dependencies: numpy scipy librosa soundfile imageio-ffmpeg.
Run with a Python environment containing those packages:
  python scripts/analyze-bibi-backing.py /path/to/full-song.mp3
Reports accompaniment pulse timings, low bass roots and stereo-side harmony for 91–124s.
The checked-in score consolidates short harmonic-estimation glitches by phrase.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("NUMBA_CACHE_DIR", str(Path(tempfile.gettempdir()) / "bibi-numba"))
import imageio_ffmpeg
import librosa
import numpy as np
import soundfile as sf

source = sys.argv[1]
with tempfile.TemporaryDirectory(prefix="bibi-reference-") as temp:
    excerpt = str(Path(temp) / "excerpt.wav")
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-ss", "91", "-t", "33", "-i", source,
        "-ar", "22050", excerpt,
    ], check=True, capture_output=True)
    audio, rate = sf.read(excerpt, always_2d=True)
    mono = audio.mean(axis=1)
    hop = 256
    harmonic = librosa.effects.harmonic(mono)
    # Stereo-side harmony reduces centered vocal contamination without extracting a melody.
    side = (audio[:, 0] - audio[:, -1]) / 2
    harmony_signal = librosa.effects.harmonic(side) if np.std(side) > np.std(mono) * 0.02 else harmonic
    chroma = librosa.feature.chroma_stft(y=harmony_signal, sr=rate, hop_length=hop, n_fft=4096, tuning=0)
    onset = librosa.onset.onset_strength(y=mono, sr=rate, hop_length=hop)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=rate, hop_length=hop, trim=False)
    pulses = librosa.frames_to_time(frames, sr=rate, hop_length=hop)
    roots = np.arange(29, 46)
    frequencies = librosa.fft_frequencies(sr=rate, n_fft=8192)
    spectrum = abs(librosa.stft(harmonic, n_fft=8192, hop_length=hop))
    salience = np.stack([
        sum(spectrum[np.argmin(abs(frequencies - frequency * k))] / k for k in range(1, 5))
        for frequency in librosa.midi_to_hz(roots)
    ])
    candidates = []
    for index, at in enumerate(pulses[::2]):
        end = min(33, pulses[::2][index + 1] if index + 1 < len(pulses[::2]) else 33)
        low = int(at * rate / hop)
        high = max(low + 1, int(end * rate / hop))
        root = int(roots[np.argmax(np.mean(salience[:, low:high], axis=1))])
        energy = np.mean(chroma[:, low:high], axis=1)
        qualities = {"minor": [0, 3, 7], "major": [0, 4, 7], "diminished": [0, 3, 6]}
        # The bass can be the third of a chord: notably the G/B passing chords.
        choices = [(chord_root, quality) for chord_root in range(12) for quality, intervals in qualities.items()
                   if root % 12 in [(chord_root + interval) % 12 for interval in intervals]]
        chord_root, quality = max(choices, key=lambda choice: sum(
            energy[(choice[0] + interval) % 12] for interval in qualities[choice[1]]))
        candidates.append({"at": round(float(at), 3), "bassMidi": root,
                           "harmonyRootPitchClass": chord_root, "triad": quality,
                           "inverted": chord_root != root % 12})
    print(json.dumps({
        "sourceStartSeconds": 91, "sourceEndSeconds": 124, "loopSeconds": 33,
        "pulseBpm": round(float(tempo[0]), 2),
        "pulseTimes": np.round(pulses, 3).tolist(), "chordCandidates": candidates,
    }, indent=2))
