"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface LiquidBackgroundProps {
  speed?: number;
  colorScheme?: 'cosmic' | 'ocean' | 'lava' | 'aurora';
  interactive?: boolean;
}

const LiquidBackground: React.FC<LiquidBackgroundProps> = ({
  speed = 0.3,
  colorScheme = 'cosmic',
  interactive = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Mouse interaction with Framer Motion
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Smooth spring animations for mouse movement
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  // Transform mouse position to shader coordinates
  const shaderMouseX = useTransform(smoothMouseX, [0, 1], [0, 1]);
  const shaderMouseY = useTransform(smoothMouseY, [0, 1], [1, 0]); // Flip Y

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false
    });

    if (!gl) {
      setError("WebGL not supported");
      return;
    }

    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform int u_colorScheme;
      uniform float u_mouseInfluence;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
          i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
          i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      float pattern(vec2 p, float t, vec2 mouse, out vec2 q, out vec2 r) {
        // Add mouse influence to the pattern
        vec2 mouseOffset = (mouse - 0.5) * u_mouseInfluence;
        
        q = vec2(
          snoise(vec3(p + mouseOffset + vec2(0.0, 0.0), t * 0.1)),
          snoise(vec3(p + mouseOffset + vec2(5.2, 1.3), t * 0.1))
        );
        
        r = vec2(
          snoise(vec3(p + 4.0 * q + vec2(1.7, 9.2), t * 0.15)),
          snoise(vec3(p + 4.0 * q + vec2(8.3, 2.8), t * 0.15))
        );
        
        return snoise(vec3(p + 4.0 * r + mouseOffset * 0.5, t * 0.05));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        float ratio = u_resolution.x / u_resolution.y;
        vec2 p = (uv - 0.5) * 1.5;
        p.x *= ratio;

        float t = u_time * 0.3;
        vec2 q, r;
        float f = pattern(p, t, u_mouse, q, r);

        f = f * 0.5 + 0.5;
        f = smoothstep(0.2, 0.8, f);

        vec3 col_deep, col_mid, col_bright;
        
        if (u_colorScheme == 0) {
          col_deep = vec3(0.01, 0.01, 0.03);
          col_mid = vec3(0.1, 0.15, 0.25);
          col_bright = vec3(0.8, 0.9, 1.0);
        } else if (u_colorScheme == 1) {
          col_deep = vec3(0.0, 0.02, 0.05);
          col_mid = vec3(0.0, 0.15, 0.3);
          col_bright = vec3(0.3, 0.7, 0.9);
        } else if (u_colorScheme == 2) {
          col_deep = vec3(0.05, 0.0, 0.0);
          col_mid = vec3(0.3, 0.05, 0.0);
          col_bright = vec3(1.0, 0.4, 0.0);
        } else {
          col_deep = vec3(0.0, 0.02, 0.03);
          col_mid = vec3(0.0, 0.2, 0.15);
          col_bright = vec3(0.2, 0.9, 0.7);
        }

        vec3 color = mix(col_deep, col_mid, f);

        float light = pow(max(0.0, f), 3.0);
        color += light * col_bright * 0.4;

        float spec = pow(f, 16.0);
        color += spec * col_bright * 0.6;

        float scatter = pow(f, 2.0) * (1.0 - f);
        color += scatter * col_mid * 0.3;

        float edge = pow(1.0 - f, 4.0);
        color += edge * col_mid * 0.2;

        vec3 warpColor = vec3(length(q), length(r), length(q - r)) * 0.1;
        color += warpColor * col_bright * 0.15;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const program = gl.createProgram();
    const vShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!program || !vShader || !fShader) {
      setError("Failed to create shader program");
      return;
    }

    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setError("Program link error: " + gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const mouseLocation = gl.getUniformLocation(program, 'u_mouse');
    const colorSchemeLocation = gl.getUniformLocation(program, 'u_colorScheme');
    const mouseInfluenceLocation = gl.getUniformLocation(program, 'u_mouseInfluence');

    const colorSchemeMap = { cosmic: 0, ocean: 1, lava: 2, aurora: 3 };
    gl.uniform1i(colorSchemeLocation, colorSchemeMap[colorScheme]);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resize);
    resize();

    // Subscribe to Framer Motion values
    const unsubscribeX = shaderMouseX.on('change', () => { });
    const unsubscribeY = shaderMouseY.on('change', () => { });

    let animationFrame: number;
    const render = (time: number) => {
      gl.uniform1f(timeLocation, time * 0.001 * speed);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(mouseLocation, shaderMouseX.get(), shaderMouseY.get());
      gl.uniform1f(mouseInfluenceLocation, interactive ? 1.0 : 0.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 100);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      unsubscribeX();
      unsubscribeY();
      gl.deleteProgram(program);
      gl.deleteShader(vShader);
      gl.deleteShader(fShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, [speed, colorScheme, interactive, shaderMouseX, shaderMouseY]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    if (!interactive) return;
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  return (
    <motion.div
      className="w-full h-screen overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
    >
      <motion.canvas
        ref={canvasRef}
        initial={{ scale: 1.1, filter: "blur(20px)" }}
        animate={{
          scale: isVisible ? 1 : 1.1,
          filter: isVisible ? "blur(0px)" : "blur(20px)"
        }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {error}
        </motion.div>
      )}
    </motion.div>
  );
};

export default LiquidBackground;
