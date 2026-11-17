// Test math calculation logic
const time = 2.5;
const width = 450, height = 380;
const n = Math.min(width * 1.15, height * 1.15);
const v = (time % 5.4) / 5.4;
const pulse = Math.max(0, Math.sin((v - 0.2) * Math.PI * 2)) ** 3;
const sway = Math.sin(time * 0.86) * 0.045;
const scale = 1.02 + Math.sin(time * 1.16) * 0.025;

console.log({ n, v, pulse, sway, scale });
