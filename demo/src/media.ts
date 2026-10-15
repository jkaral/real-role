import { spawn } from "node:child_process";
import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { delimiter, resolve } from "node:path";
import { segments } from "./timeline";

export function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      command === "ffmpeg" ? ["-hide_banner", "-loglevel", "error", ...args] : args,
      { stdio: "inherit", shell: false, windowsHide: true },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

function duration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        path,
      ],
      { stdio: ["ignore", "pipe", "inherit"], windowsHide: true },
    );
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      const seconds = Number(output.trim());
      if (code === 0 && Number.isFinite(seconds) && seconds > 0) resolve(seconds);
      else reject(new Error("Cannot measure generated speech duration."));
    });
  });
}

export async function narrate(): Promise<string> {
  // An optional workspace-local Python install keeps host-wide packages unnecessary.
  if (!process.env.OPENAI_API_KEY) {
    try {
      await access("output/python/edge_tts");
      process.env.PYTHONPATH = [resolve("output/python"), process.env.PYTHONPATH]
        .filter(Boolean)
        .join(delimiter);
    } catch {
      /* Otherwise use the configured Python's installed edge-tts. */
    }
  }
  const audio: string[] = [];
  for (const [index, segment] of segments.entries()) {
    const mp3 = `output/voice-${index}.mp3`;
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "tts-1", voice: "alloy", input: segment.text }),
      });
      if (!response.ok)
        throw new Error(
          `TTS failed (${response.status}); retry without OPENAI_API_KEY to use edge-tts.`,
        );
      await writeFile(mp3, Buffer.from(await response.arrayBuffer()));
    } else {
      await run(process.env.DEMO_PYTHON ?? "python", [
        "-m",
        "edge_tts",
        "--voice",
        "en-CA-ClaraNeural",
        "--text",
        segment.text,
        "--write-media",
        mp3,
      ]);
    }
    const output = `output/voice-${index}.wav`;
    const interval = segment.end - segment.start;
    const speed = Math.max(1, (await duration(mp3)) / (interval - 0.2));
    if (speed > 1.5)
      throw new Error(
        "Narration is too long for its interval; shorten the script before recording.",
      );
    // Fit complete speech before padding; never truncate the spoken sentence.
    await run("ffmpeg", [
      "-y",
      "-i",
      mp3,
      "-af",
      `atempo=${speed.toFixed(5)},apad`,
      "-t",
      String(segment.end - segment.start),
      "-ar",
      "48000",
      "-ac",
      "2",
      output,
    ]);
    audio.push(`file 'voice-${index}.wav'`);
  }
  await writeFile("output/audio-list.txt", audio.join("\n") + "\n");
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "output/audio-list.txt",
    "-c",
    "copy",
    "output/narration.wav",
  ]);
  return "output/narration.wav";
}

export async function assemble(recording: string, audio: string, webUrl: string): Promise<void> {
  await mkdir("output/fonts/cache", { recursive: true });
  const font =
    process.env.DEMO_FONT_PATH ??
    (process.platform === "win32"
      ? "C:/Windows/Fonts/segoeui.ttf"
      : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf");
  await copyFile(font, "output/fonts/demo.ttf");
  const xml = (path: string) =>
    path.replaceAll("\\", "/").replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  await writeFile(
    "output/fonts/fonts.conf",
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${xml(resolve("output/fonts"))}</dir><cachedir>${xml(resolve("output/fonts/cache"))}</cachedir></fontconfig>`,
  );
  process.env.FONTCONFIG_FILE = resolve("output/fonts/fonts.conf");
  // Text files keep URL text out of ffmpeg's filter expression grammar.
  await writeFile("output/title.txt", "REAL ROLE\nSignals before you apply");
  await writeFile(
    "output/end.txt",
    `Make an informed application\n${webUrl}\nAI-generated narration · Fictional demo content`,
  );
  const style = "fontcolor=white:fontsize=54:x=(w-text_w)/2:y=(h-text_h)/2";
  for (const [name, seconds] of [
    ["title", 4],
    ["end", 8],
  ] as const) {
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x18372d:s=1920x1080:r=30:d=${seconds}`,
      "-vf",
      `drawtext=fontfile=output/fonts/demo.ttf:textfile=output/${name}.txt:${style}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      `output/${name}.mp4`,
    ]);
  }
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    recording,
    "-vf",
    "scale=1920:1080,fps=30,setsar=1",
    "-an",
    "-t",
    "60",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "output/run.mp4",
  ]);
  await writeFile("output/video-list.txt", "file 'title.mp4'\nfile 'run.mp4'\nfile 'end.mp4'\n");
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    "output/video-list.txt",
    "-i",
    audio,
    "-vf",
    "subtitles=output/captions.srt:fontsdir=output/fonts:force_style='Fontsize=14,MarginV=16'",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-t",
    "72",
    "-movflags",
    "+faststart",
    "output/real-role-demo.mp4",
  ]);
}
