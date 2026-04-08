import { Environment, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { PaintColor, WheelStyle } from '../lib/types'

type CarShowroomCanvasProps = {
  selectedColor: PaintColor
  selectedWheel: WheelStyle
  viewMode: 'exterior' | 'front' | 'rear' | 'interior'
  onDragStart: () => void
}

type ViewMode = CarShowroomCanvasProps['viewMode']

function ConceptCar({ selectedColor, selectedWheel }: Pick<CarShowroomCanvasProps, 'selectedColor' | 'selectedWheel'>) {
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: selectedColor.hex,
        metalness: 0.62,
        roughness: 0.18,
        clearcoat: 0.92,
        clearcoatRoughness: 0.09,
      }),
    [selectedColor.hex],
  )

  const wheelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9FA8B2',
        metalness: selectedWheel.metalness,
        roughness: selectedWheel.roughness,
      }),
    [selectedWheel.metalness, selectedWheel.roughness],
  )

  return (
    <group position={[0, -0.45, 0]}>
      <mesh position={[0, 0.45, 0]} material={bodyMaterial} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.5, 1.2]} />
      </mesh>

      <mesh position={[0.15, 0.82, 0]} material={bodyMaterial} castShadow>
        <boxGeometry args={[1.55, 0.45, 1.08]} />
      </mesh>

      <mesh position={[1.25, 0.38, 0]} material={new THREE.MeshStandardMaterial({ color: '#DFF0FF' })}>
        <boxGeometry args={[0.2, 0.18, 0.96]} />
      </mesh>

      <Wheel position={[-0.88, -0.01, 0.68]} material={wheelMaterial} />
      <Wheel position={[0.88, -0.01, 0.68]} material={wheelMaterial} />
      <Wheel position={[-0.88, -0.01, -0.68]} material={wheelMaterial} />
      <Wheel position={[0.88, -0.01, -0.68]} material={wheelMaterial} />
    </group>
  )
}

type WheelProps = {
  position: [number, number, number]
  material: THREE.Material
}

function Wheel({ position, material }: WheelProps) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh material={material} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.18, 36]} />
      </mesh>
      <mesh material={new THREE.MeshStandardMaterial({ color: '#111821', metalness: 0.15, roughness: 0.84 })}>
        <cylinderGeometry args={[0.18, 0.18, 0.19, 30]} />
      </mesh>
    </group>
  )
}

type CameraDirectorProps = {
  viewMode: ViewMode
  controlsRef: { current: any }
}

function CameraDirector({ viewMode, controlsRef }: CameraDirectorProps) {
  const { camera } = useThree()

  useEffect(() => {
    const presets: Record<ViewMode, { position: [number, number, number]; target: [number, number, number] }> = {
      exterior: { position: [4.8, 2.1, 3.8], target: [0, 0.45, 0] },
      front: { position: [5.6, 1.5, 0], target: [0.8, 0.5, 0] },
      rear: { position: [-5.3, 1.4, 0], target: [-0.8, 0.45, 0] },
      interior: { position: [0.25, 1.12, 0], target: [1.2, 0.95, 0] },
    }

    const next = presets[viewMode]
    camera.position.set(...next.position)
    if (controlsRef.current) {
      controlsRef.current.target.set(...next.target)
      controlsRef.current.update()
    }
  }, [camera, controlsRef, viewMode])

  return null
}

export default function CarShowroomCanvas({ selectedColor, selectedWheel, viewMode, onDragStart }: CarShowroomCanvasProps) {
  const draggedRef = useRef(false)
  const controlsRef = useRef<any>(null)

  const handleControlStart = () => {
    if (draggedRef.current) return
    draggedRef.current = true
    onDragStart()
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ fov: 38, position: [4.8, 2.1, 3.8] }}
      className="h-full w-full"
    >
      <color attach="background" args={['#07131f']} />
      <fog attach="fog" args={['#07131f', 8, 18]} />

      <ambientLight intensity={0.45} />
      <spotLight
        position={[4, 9, 4]}
        intensity={2.2}
        penumbra={0.45}
        angle={0.38}
        castShadow
      />

      <directionalLight position={[-5, 4, -3]} intensity={0.65} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]} receiveShadow>
        <circleGeometry args={[8, 50]} />
        <meshStandardMaterial color="#0a1b2b" roughness={0.8} metalness={0.18} />
      </mesh>

      <Suspense fallback={null}>
        <ConceptCar selectedColor={selectedColor} selectedWheel={selectedWheel} />
        <Environment preset="night" />
        <CameraDirector viewMode={viewMode} controlsRef={controlsRef} />
      </Suspense>

      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.55}
        enablePan={false}
        maxDistance={8}
        minDistance={3.6}
        maxPolarAngle={Math.PI / 2.05}
        onStart={handleControlStart}
      />
    </Canvas>
  )
}
