// ScrollZoomHouseScene.tsx
import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import { Vector3, PerspectiveCamera } from 'three'

const HouseModel = () => {
  const { scene } = useGLTF('/tiny_home/Tiny_House.glb')
  return <primitive object={scene} />
}

const CameraRig = ({ scroll }: { scroll: number }) => {
  const { camera } = useThree()

  const startPos = new Vector3(0, 2.5, 6)
  const endPos = new Vector3(0, 1.2, -2) // 📍 deeper inside or behind the house
  const lookAtTarget = new Vector3(0, 1.5, 0)

  useFrame(() => {
    const lerped = startPos.clone().lerp(endPos, scroll)
    camera.position.copy(lerped)

    // Optional: rotate target over time (simple walkthrough effect)
    const dynamicTarget = lookAtTarget
      .clone()
      .add(new Vector3(0, 0, -scroll * 3))
    camera.lookAt(dynamicTarget)
  })

  return null
}

export default function ScrollZoomHouseScene() {
  const [scroll, setScroll] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight
      const current = window.scrollY
      setScroll(Math.min(current / max, 1))
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div style={{ height: '200vh' }}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
        }}
      >
        <Canvas>
          <Environment preset="sunset" background />
          <CameraRig scroll={scroll} />
          <Suspense fallback={null}>
            <HouseModel />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

// Stylesheet (CSS or Tailwind)
// Ensure the canvas fills the screen and scrolling works:
// html, body { height: 200vh; margin: 0; overflow-y: scroll; }
// canvas { display: block; }
