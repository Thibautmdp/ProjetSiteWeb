'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RefObject } from 'react'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Extruded profile of a single hairdressing-shear blade.
 * Base sits at the pivot (y≈0), the fine cutting tip points toward +Y.
 * The spine (outer edge) curves gently while the cutting edge stays crisp,
 * tapering to a sharp point.
 */
function useBladeGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape()
    // start at the pivot heel
    shape.moveTo(0.0, -0.1)
    // cutting edge (inner) rises almost straight
    shape.lineTo(0.09, 0.15)
    shape.lineTo(0.075, 2.6)
    // fine tapered tip
    shape.quadraticCurveTo(0.05, 3.35, 0.0, 3.55)
    // spine (outer/back) curving back down to the heel
    shape.quadraticCurveTo(-0.04, 3.2, -0.09, 2.4)
    shape.lineTo(-0.14, 0.5)
    shape.quadraticCurveTo(-0.16, 0.0, 0.0, -0.1)

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.022,
      bevelSegments: 4,
      steps: 1,
    })
    geo.center()
    geo.translate(0, 1.7, 0)
    return geo
  }, [])
}

/**
 * Curved shank + finger ring for one half of the shears, built as a swept
 * tube so the transition from pivot to handle reads as a smooth S-curve.
 */
function useShankGeometry(side: 1 | -1) {
  return useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.0, 0),
      new THREE.Vector3(side * 0.18, -0.55, 0),
      new THREE.Vector3(side * 0.12, -1.15, 0),
      new THREE.Vector3(side * 0.5, -1.7, 0),
      new THREE.Vector3(side * 0.86, -2.05, 0),
    ])
    return new THREE.TubeGeometry(curve, 48, 0.075, 16, false)
  }, [side])
}

function ScissorHalf({
  side,
  steel,
  showTang,
}: {
  side: 1 | -1
  steel: THREE.Material
  showTang?: boolean
}) {
  const blade = useBladeGeometry()
  const shank = useShankGeometry(side)

  return (
    <group>
      {/* Blade */}
      <mesh geometry={blade} material={steel} scale={[side, 1, 1]} castShadow />
      {/* Curved shank */}
      <mesh geometry={shank} material={steel} castShadow />
      {/* Finger ring */}
      <mesh
        material={steel}
        position={[side * 1.02, -2.5, 0]}
        rotation={[Math.PI / 2, 0, side * 0.32]}
        castShadow
      >
        <torusGeometry args={[0.46, 0.075, 24, 56]} />
      </mesh>
      {/* Finger rest / tang hook on the lower half only */}
      {showTang && (
        <mesh
          material={steel}
          position={[side * 0.72, -2.72, 0]}
          rotation={[Math.PI / 2, 0, side * 0.9]}
          castShadow
        >
          <torusGeometry args={[0.14, 0.045, 12, 24, Math.PI * 1.3]} />
        </mesh>
      )}
    </group>
  )
}

export default function Scissors({
  progress,
}: {
  progress: RefObject<number>
}) {
  const group = useRef<THREE.Group>(null)

  const steel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#cdc7ba'),
        metalness: 0.7,
        roughness: 0.28,
        emissive: new THREE.Color('#26241f'),
        emissiveIntensity: 0.28,
      }),
    [],
  )

  const brass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#c99f5e'),
        metalness: 0.65,
        roughness: 0.34,
        emissive: new THREE.Color('#3a2f18'),
        emissiveIntensity: 0.4,
      }),
    [],
  )

  useFrame((state, delta) => {
    if (!group.current) return
    const p = progress.current ?? 0
    const t = state.clock.elapsedTime

    // scroll-driven rotation (multiple turns) + gentle idle spin
    const targetY = p * Math.PI * 3 + t * 0.15
    const targetX = lerp(0.15, -0.35, p) + Math.sin(t * 0.6) * 0.05
    const targetZ = lerp(-0.35, 0.1, p)

    group.current.rotation.y = targetY
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      targetX,
      4,
      delta,
    )
    group.current.rotation.z = THREE.MathUtils.damp(
      group.current.rotation.z,
      targetZ,
      4,
      delta,
    )

    // scroll-driven scale (grows as you scroll)
    const targetScale = lerp(0.62, 1.28, p)
    const s = THREE.MathUtils.damp(group.current.scale.x, targetScale, 4, delta)
    group.current.scale.setScalar(s)

    // subtle vertical float
    group.current.position.y = Math.sin(t * 0.8) * 0.08
  })

  return (
    <group ref={group} rotation={[0.15, 0, -0.35]}>
      {/* two crossing halves, opened around the pivot */}
      <group rotation={[0, 0, 0.2]}>
        <ScissorHalf side={1} steel={steel} showTang />
      </group>
      <group rotation={[0, 0, -0.2]}>
        <ScissorHalf side={-1} steel={steel} />
      </group>
      {/* Pivot screw — domed brass cap */}
      <mesh material={brass} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.24, 28]} />
      </mesh>
      <mesh material={brass} position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.11, 20, 16]} />
      </mesh>
      <mesh material={brass} position={[0, 0, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.06, 20]} />
      </mesh>
    </group>
  )
}
