# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "imageio-ffmpeg"]
# ///
"""Render 暗线, the Joker Legion score. Run with uv run scripts/compose-score.py."""
import re
import subprocess
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, oaconvolve, sosfilt

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
EIGHTH = 0.25  # 6/8, dotted quarter = 80 bpm
BAR = 6 * EIGHTH
PERIOD = 32 * 6
SAMPLES = round(RATE * PERIOD * EIGHTH)
TAU = 2 * np.pi

# Bass note and four ordered upper voices. The middle eight open into F major.
VOICINGS = {
    'Dm': 'D2 F3 A3 D4 E4', 'Dm/C': 'C2 F3 A3 D4 E4',
    'Bb': 'Bb1 F3 A3 Bb3 D4', 'A7': 'A1 E3 G3 C#4 E4',
    'Gm': 'G2 D3 G3 Bb3 D4', 'Dm/F': 'F2 D3 A3 D4 F4',
    'Ehalf': 'E2 G3 Bb3 D4 G4', 'F/A': 'A1 F3 A3 C4 E4',
    'Eb': 'Eb2 G3 Bb3 D4 Eb4', 'Gm/Bb': 'Bb1 D3 G3 Bb3 D4',
    'Asus': 'A1 E3 G3 A3 D4', 'F': 'F2 A3 C4 E4 F4',
    'C/E': 'E2 G3 C4 E4 G4', 'Am/C': 'C2 E3 A3 C4 E4',
    'Dm/A': 'A1 F3 A3 D4 F4', 'A7b9': 'A1 G3 Bb3 C#4 E4',
}
HARMONY = (
    'Dm Dm/C Bb A7 Gm Dm/F Ehalf A7 '
    'Dm F/A Bb Gm Eb Gm/Bb Asus A7 '
    'F C/E Dm Am/C Bb F/A Gm A7 '
    'Dm Bb Gm Dm/A Eb Gm/Bb A7b9 A7'
).split()

# Durations in eighths, dot = rest. Each line is one bar.
MELODY = [
    'A4:2 . Bb4 F4 E4', 'D4:3 . A3 D4', 'F4:2 A4 G4:2 F4', 'E4:3 .:2 C#4',
    'D4 G4:2 Bb4:2 A4', 'F4:3 E4 D4 .', 'G4:2 F4 E4:2 Bb3', 'C#4:3 .:3',
    'A4:2 . Bb4 F4 E4', 'C5:3 A4 . F4', 'D5:2 C5 A4:2 F4', 'G4:4 . D4',
    'Eb4 G4 Bb4 D5:2 C5', 'Bb4:2 G4 D4:3', 'E4:2 . A4 G4 D4', 'C#4:4 .:2',
    'F4:2 A4 C5:3', 'B4 C5:2 G4:2 E4', 'A4:2 . D5 C5 A4', 'G4 E4:2 .:3',
    'F4:2 A4 D5:2 C5', 'A4:2 G4 E4:2 F4', 'D4 G4:2 Bb4 A4 G4', 'E4:3 . C#4 E4',
    'A4:2 . Bb4 F4 E4', 'D4:3 . F4 A4', 'Bb4:2 D5 C5:2 Bb4', 'A4:3 F4 D4 .',
    'G4:2 Bb4 Eb5:2 D5', 'Bb4:2 G4 D4:3', 'F4 E4:2 Bb3 C#4:2', 'E4:3 .:2 A3',
]


def midi(note):
    name, accidental, octave = re.fullmatch(r'([A-G])([#b]?)(\d)', note).groups()
    degree = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[name]
    return 12 * (int(octave) + 1) + degree + {'': 0, '#': 1, 'b': -1}[accidental]


def filtered_noise(rng, t, frequencies):
    noise = rng.standard_normal(len(t))
    return sosfilt(butter(2, frequencies, fs=RATE, btype='bandpass', output='sos'), noise)


def instrument(voice, pitch, length, rng):
    """A dry, articulated mono note, including its release into the room."""
    f = 440 * 2 ** ((pitch - 69) / 12)
    tail = {'keys': .82, 'pizz': .28, 'reed': .18, 'bow': .32, 'bell': 1.25,
            'drum': .22, 'brush': .12}[voice]
    t = np.arange(round((length + tail) * RATE)) / RATE
    gate = np.maximum(t - length, 0)
    phase = TAU * f * t
    if voice in ('keys', 'pizz', 'bell'):
        ratios, weights = {
            'keys': ([1, 2.001, 3.007, 4.014, 5.027, 7.06], [1, .49, .22, .12, .067, .024]),
            'pizz': ([1, 2.002, 3.008, 4.019, 5.03, 6.05], [1, .55, .31, .11, .13, .038]),
            'bell': ([1, 2.006, 3.97, 5.43], [1, .31, .24, .075]),
        }[voice]
        decay = {'keys': 1.35, 'pizz': .53, 'bell': 1.75}[voice]
        note = np.zeros_like(t)
        for r, w in zip(ratios, weights):
            partial = np.sin(phase * r)
            if voice == 'keys':
                partial = .76 * partial + .24 * np.sin(phase * r * 1.0017)
            note += w * partial * np.exp(-t * (1 + .51 * (r - 1)) / decay)
        if voice != 'bell':
            note += .19 * filtered_noise(rng, t, [370, 3200]) * np.exp(-t / .014)
        attack = .003 if voice == 'pizz' else .007
        return note * (1-np.exp(-t/attack)) * np.exp(-gate/(tail/7))
    if voice in ('reed', 'bow'):
        bowed = voice == 'bow'
        vibrato = (1-np.exp(-t/.28)) * .0028 * np.sin(TAU*rng.uniform(4.4,5.4)*t)
        phase = TAU * f / RATE * np.cumsum(1 + vibrato - .004*np.exp(-t/.025))
        weights = ([1, .53, .39, .23, .18, .12, .08, .055, .032] if bowed else
                   [1, .105, .44, .075, .17, .038, .076, .023, .038])
        note = np.zeros_like(t)
        for h, w in enumerate(weights, 1):
            # Two gently detuned desks of strings, or one centred air column.
            tone = np.sin(h*phase)
            if bowed:
                tone = .55*tone + .45*np.sin(h*(phase*1.0023 + .45))
            note += w*tone
        attack = .083 if bowed else .042
        breath = filtered_noise(rng, t, [550, 2450])
        env = (1-np.exp(-t/attack)) * np.exp(-gate/(tail/7))
        return (note + .07*breath) * env * (.88+.12*np.sin(t*3.4+rng.uniform(0,3)))
    if voice == 'drum':
        membrane = np.sin(TAU*(59*t + 1.3*(1-np.exp(-t/.023))))*np.exp(-t/.105)
        rim = np.sin(TAU*139*t)*np.exp(-t/.048)
        note = membrane+.27*rim+.54*filtered_noise(rng,t,[130,1500])*np.exp(-t/.031)
    else:
        note = filtered_noise(rng,t,[670,4500])*np.exp(-t/.042)
        note += .22*np.sin(TAU*242*t)*np.exp(-t/.032)
    return note * (1-np.exp(-t/.002))


def add_wrapped(bus, start, samples):
    start %= len(bus)
    split = min(len(samples), len(bus)-start)
    bus[start:start+split] += samples[:split]
    bus[:len(samples)-split] += samples[split:]


def room(mix):
    """Stereo early reflections and a short diffuse tail; wrap the tail over bar one."""
    rng = np.random.default_rng(411)
    t = np.arange(int(.94*RATE)) / RATE
    result = mix.copy()
    for side in range(2):
        ir = filtered_noise(rng,t,[180,3900]) * np.exp(-t/.147)
        ir[:int(.024*RATE)] = 0
        ir *= .17 / np.sqrt(np.sum(ir*ir))
        for delay, level in [(0.026,.103),(.043,.083),(.069,.058),(.109,.037)]:
            ir[int((delay+.006*side)*RATE)] += level
        wet = oaconvolve(.67*mix[:,side]+.33*mix[:,1-side],ir)
        add_wrapped(result[:,side],0,wet[:SAMPLES])
        add_wrapped(result[:,side],0,wet[SAMPLES:])
    return result


def arrange(scene):
    rng = np.random.default_rng(6302)
    mix = np.zeros((SAMPLES,2))
    for bar, symbol in enumerate(HARMONY):
        bass, *chord = map(midi, VOICINGS[symbol].split())
        # Gradually open the middle section and pull back into the turnaround.
        swell = (0.88, 0.96, 1.08, 1.0)[bar//8] * (.86 if bar%8 == 7 else 1)

        def play(beat, voice, pitch, duration, strength, pan=0):
            note = instrument(voice,pitch,duration*EIGHTH,rng)
            start = round(((bar*6+beat)*EIGHTH+rng.uniform(.001,.009))*RATE)
            gain = strength*swell*rng.uniform(.94,1.045)
            angle = (1+pan)*np.pi/4
            add_wrapped(mix[:,0],start,note*gain*np.cos(angle))
            add_wrapped(mix[:,1],start,note*gain*np.sin(angle))

        position = 0
        for token in MELODY[bar].split():
            name, _, count = token.partition(':')
            duration = int(count or 1)
            if name != '.':
                p = midi(name)
                if scene == 'title':
                    play(position,'keys',p,duration*.88,.34,.13)
                    if bar%8 in (3,7) and position==0:
                        play(position+.035,'bell',p+12,2,.060,.40)
                elif scene == 'camp':
                    play(position,'pizz',p,duration*.80,.29,.16)
                    if duration>=3:
                        play(position+.025,'reed',p-12,duration*.80,.15,-.16)
                else:
                    play(position,'bow',p-12,duration*.78,.205,-.11)
                    if position==0 or (bar//8==2 and duration>=2):
                        play(position+.018,'keys',p,duration*.70,.16,.18)
            position += duration
        assert position == 6

        if scene == 'title':
            play(0,'pizz',bass,2.8,.27,-.08)
            play(.12,'bow',chord[0],4.2,.088,-.38)
            if bar%4!=3:
                play(2.5,'keys',chord[1],1.4,.12,-.32)
                play(4,'keys',chord[3],1.1,.105,.30)
            if bar%4 in (1,3):
                play(3,'reed',chord[1],2.45,.165,-.22)
        elif scene == 'camp':
            play(0,'pizz',bass,2.05,.39,-.10)
            play(3,'pizz',bass+7,1.15,.245,-.08)
            for at, part in [(1.45,1),(2.53,2),(4.47,0)]:
                play(at,'keys',chord[part],.72,.16,(-.32,.28,-.22)[part])
            if bar%2==0:
                play(5.18,'pizz',chord[2],.55,.14,.35)
            if bar//8 in (1,2):
                play(.08,'bow',chord[1],4.1,.069,-.4)
        else:
            # Two large footfalls against a six-eighth ostinato. Leave space
            # around the second downbeat for combat transients.
            for at, pitch, level in [(0,bass,.41),(1,bass+12,.17),(2,chord[1],.19),
                                     (3,bass+7,.32),(4.5,chord[0],.20),(5.4,chord[1],.13)]:
                play(at,'pizz',pitch,.78,level,-.16 if at<3 else .12)
            play(0,'drum',36,.48,.42)
            play(3,'brush',50,.32,.26,.24)
            if bar%4 in (1,2):
                play(4.5,'drum',36,.35,.18,-.18)
            if bar%4==3:
                for at,level in [(4.7,.09),(5.18,.13),(5.65,.18)]:
                    play(at,'brush',50,.26,level,.20)
            if bar%2==0:
                play(.10,'reed',chord[0],2.45,.135,-.30)
            if bar//8 in (1,2):
                play(3.02,'bow',chord[2],2.18,.12,.39)
    return room(mix)


def encode(path, stereo, tmp):
    pcm = np.round(np.clip(stereo,-.999,.999)*32767).astype('<i2')
    wavfile.write(tmp,RATE,pcm)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
                    '-i',str(tmp),'-codec:a','libmp3lame','-q:a','3','-map_metadata','-1',
                    str(path)],check=True)


def main():
    tracks = ROOT/'public'/'music'
    tracks.mkdir(exist_ok=True)
    preview_dir = ROOT/'output'
    preview_dir.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        tmp = Path(temp)/'render.wav'
        arrangements = []
        for scene in ('title','camp','battle'):
            signal = arrange(scene)
            rms = np.sqrt(np.mean(signal**2))
            signal *= min(.115/rms, .85/np.max(np.abs(signal)))
            encode(tracks/(scene+'.mp3'),signal,tmp)
            arrangements.append(signal)
        # The preview follows the actual shared score clock across both handoffs.
        preview = arrangements[0].copy()
        seconds = np.arange(SAMPLES)/RATE
        for at, incoming in [(8*BAR,arrangements[1]),(16*BAR,arrangements[2])]:
            fade = np.clip((seconds-at)/BAR,0,1)[:,None]
            preview = preview*(1-fade) + incoming*fade
        preview *= np.clip(seconds/.15,0,1)[:,None]*np.clip((seconds[-1]-seconds)/1.25,0,1)[:,None]
        encode(preview_dir/'暗线-配乐试听.mp3',preview,tmp)


if __name__ == '__main__':
    main()
