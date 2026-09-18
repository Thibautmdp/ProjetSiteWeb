'use client'

import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import type { RefObject } from 'react'
import Scissors from './scissors'

/** Keep the WebGL context alive across scroll repaints / software renderers. */
function ContextGuard() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => e.preventDefault()
    const onRestored = () => invalidate()
    canvas.addEventListener('webglcontextlost', onLost, false)
    canvas.addEventListener('webglcontextrestored', onRestored, false)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl, invalidate])

  return null
}

export default function HeroCanvas({
  progress,
}: {
  progress: RefObject<number>
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 40 }}
      gl={{
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      }}
      dpr={[1, 1.5]}
    >
      <ContextGuard />

      {/* Studio-style multi-light rig so the metal reads without an HDR env map */}
      <ambientLight intensity={0.9} />
      <hemisphereLight args={['#fff2d8', '#20242e', 0.9]} />
      <directionalLight position={[5, 6, 6]} intensity={3} color="#fff4e0" />
      <directionalLight position={[-6, 2, 3]} intensity={1.8} color="#cfe0ff" />
      <directionalLight position={[0, -4, 4]} intensity={1.2} color="#ffcf8f" />
      <spotLight
        position={[0, 9, 3]}
        angle={0.5}
        penumbra={1}
        intensity={2.4}
        color="#ffd9a0"
      />

      <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.4}>
        <Scissors progress={progress} />
      </Float>
    </Canvas>
  )
}
