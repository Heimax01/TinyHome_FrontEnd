import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react'
import {
  X,
  ChevronDown,
  ChevronUp,
  Move,
  Eye,
  EyeOff,
  RotateCcw,
} from 'lucide-react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls, Environment } from '@react-three/drei'
import type { Group, Vector3 } from 'three'
import { Vector3 as ThreeVector3 } from 'three'

// Interface for sphere positioning data
interface SpherePosition {
  id: number
  x: number
  y: number
  z: number
  visible: boolean
  color: string
  name: string
}

// LOD Quality levels
type LODLevel = 'low' | 'medium' | 'high'

// Performance monitoring hook
function usePerformanceMonitor() {
  const [fps, setFps] = useState<number>(60)
  const frameCount = useRef<number>(0)
  const lastTime = useRef<number>(performance.now())

  useFrame(() => {
    frameCount.current++
    const currentTime = performance.now()

    if (currentTime - lastTime.current >= 1000) {
      setFps(frameCount.current)
      frameCount.current = 0
      lastTime.current = currentTime
    }
  })

  return fps
}

// Distance-based LOD calculation hook
function useDistanceLOD(
  position: [number, number, number],
  camera: any,
  focusedSphere: number | null,
  sphereId?: number
) {
  return useMemo(() => {
    const spherePos = new ThreeVector3(...position)
    const distance = camera.position.distanceTo(spherePos)

    // Special case: if this sphere is focused, always use high detail
    if (sphereId && focusedSphere === sphereId) {
      return {
        detail: 'high' as LODLevel,
        visible: true,
        showWireframe: true,
        showFloating: true,
        geometryDetail: { widthSegments: 32, heightSegments: 32 },
      }
    }

    // Distance-based LOD
    if (distance < 2) {
      return {
        detail: 'high' as LODLevel,
        visible: true,
        showWireframe: true,
        showFloating: true,
        geometryDetail: { widthSegments: 16, heightSegments: 16 },
      }
    } else if (distance < 5) {
      return {
        detail: 'medium' as LODLevel,
        visible: true,
        showWireframe: true,
        showFloating: true,
        geometryDetail: { widthSegments: 12, heightSegments: 12 },
      }
    } else if (distance < 10) {
      return {
        detail: 'low' as LODLevel,
        visible: true,
        showWireframe: false,
        showFloating: false,
        geometryDetail: { widthSegments: 8, heightSegments: 8 },
      }
    } else {
      return {
        detail: 'low' as LODLevel,
        visible: false,
        showWireframe: false,
        showFloating: false,
        geometryDetail: { widthSegments: 6, heightSegments: 6 },
      }
    }
  }, [position, camera.position, focusedSphere, sphereId])
}

// LOD-Optimized Positioning Sphere Component
function LODPositioningSphere({
  position,
  color,
  visible,
  sphereId,
  focusedSphere,
}: {
  position: [number, number, number]
  color: string
  visible: boolean
  sphereId: number
  focusedSphere: number | null
}) {
  const meshRef = useRef<Group>(null)
  const { camera } = useThree()

  // LOD calculation
  const lod = useDistanceLOD(position, camera, focusedSphere, sphereId)

  // Performance monitoring
  const fps = usePerformanceMonitor()

  // Performance adjustment factor
  const performanceAdjustment = useMemo(() => {
    if (fps < 30) return 0.6
    if (fps < 45) return 0.8
    return 1.0
  }, [fps])

  // Adjust geometry detail based on performance
  const finalGeometryDetail = useMemo(() => {
    const baseDetail = lod.geometryDetail
    const performanceFactor = performanceAdjustment

    return {
      widthSegments: Math.max(
        6,
        Math.floor(baseDetail.widthSegments * performanceFactor)
      ),
      heightSegments: Math.max(
        6,
        Math.floor(baseDetail.heightSegments * performanceFactor)
      ),
    }
  }, [lod.geometryDetail, performanceAdjustment])

  // Calculate opacity based on distance and performance
  const opacity = useMemo(() => {
    const baseOpacity = 0.9
    const distanceOpacity =
      lod.detail === 'high' ? 1.0 : lod.detail === 'medium' ? 0.8 : 0.6
    return baseOpacity * distanceOpacity * performanceAdjustment
  }, [lod, performanceAdjustment])

  useFrame((state) => {
    if (meshRef.current && visible && lod.visible) {
      // Gentle floating animation only if performance allows
      const floatingIntensity = lod.showFloating && fps > 30 ? 0.05 : 0
      meshRef.current.position.set(
        position[0],
        position[1] +
          Math.sin(state.clock.elapsedTime * 2 + sphereId) * floatingIntensity,
        position[2]
      )
    }
  })

  // Don't render if not visible or too far away
  if (!visible || !lod.visible) return null

  return (
    <group ref={meshRef} position={[position[0], position[1], position[2]]}>
      {/* Main sphere with adaptive quality */}
      <mesh>
        <sphereGeometry
          args={[
            0.15,
            finalGeometryDetail.widthSegments,
            finalGeometryDetail.heightSegments,
          ]}
        />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          emissive={color}
          emissiveIntensity={0.3 * performanceAdjustment}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Wireframe overlay - only show if LOD allows and performance is good */}
      {lod.showWireframe && fps > 30 && (
        <mesh>
          <sphereGeometry
            args={[
              0.18,
              Math.max(6, Math.floor(finalGeometryDetail.widthSegments * 0.75)),
              Math.max(
                6,
                Math.floor(finalGeometryDetail.heightSegments * 0.75)
              ),
            ]}
          />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={opacity * 0.4}
          />
        </mesh>
      )}
    </group>
  )
}

// Ultra-Close Camera Positioning System with Minimal Distance
function UltraCloseCameraAnimation({
  cameraTarget,
  modelScale,
  onAnimationComplete,
  focusedSphere,
  spheres,
  cameraMode,
}: {
  cameraTarget: {
    position: [number, number, number]
    lookAt: [number, number, number]
    animating: boolean
  }
  modelScale: number
  onAnimationComplete: () => void
  focusedSphere: number | null
  spheres: SpherePosition[]
  cameraMode: 'overview' | 'focused' | 'transitioning'
}) {
  const { camera } = useThree()
  const currentPosition = useRef<[number, number, number]>([0, 3, 8])
  const currentLookAt = useRef<[number, number, number]>([0, 0, 0])
  const isAnimating = useRef<boolean>(false)
  const isLocked = useRef<boolean>(false)

  // Performance monitoring for adaptive quality
  const fps = usePerformanceMonitor()

  // Ultra-smooth animation quality
  const animationQuality = useMemo(() => {
    if (fps < 30) return { lerpFactor: 0.08, updateFrequency: 2 }
    if (fps < 45) return { lerpFactor: 0.06, updateFrequency: 1 }
    return { lerpFactor: 0.04, updateFrequency: 1 } // Ultra-smooth for cinematic feel
  }, [fps])

  const frameCounter = useRef<number>(0)

  useFrame(() => {
    frameCounter.current++

    // Skip frames for performance if needed
    if (frameCounter.current % animationQuality.updateFrequency !== 0) return

    if (cameraTarget.animating && !isAnimating.current) {
      // Start new animation - capture current position
      currentPosition.current = [
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ]
      currentLookAt.current = [
        cameraTarget.lookAt[0],
        cameraTarget.lookAt[1],
        cameraTarget.lookAt[2],
      ]
      isAnimating.current = true
    }

    if (cameraTarget.animating || isAnimating.current) {
      // Use ultra-smooth lerp factor
      const lerpFactor = animationQuality.lerpFactor

      // Animate position
      currentPosition.current[0] +=
        (cameraTarget.position[0] - currentPosition.current[0]) * lerpFactor
      currentPosition.current[1] +=
        (cameraTarget.position[1] - currentPosition.current[1]) * lerpFactor
      currentPosition.current[2] +=
        (cameraTarget.position[2] - currentPosition.current[2]) * lerpFactor

      // Animate look-at
      currentLookAt.current[0] +=
        (cameraTarget.lookAt[0] - currentLookAt.current[0]) * lerpFactor
      currentLookAt.current[1] +=
        (cameraTarget.lookAt[1] - currentLookAt.current[1]) * lerpFactor
      currentLookAt.current[2] +=
        (cameraTarget.lookAt[2] - currentLookAt.current[2]) * lerpFactor

      // Apply camera position and look-at
      camera.position.set(...currentPosition.current)
      camera.lookAt(...currentLookAt.current)

      // Check if animation is complete
      const positionDistance = Math.sqrt(
        Math.pow(cameraTarget.position[0] - currentPosition.current[0], 2) +
          Math.pow(cameraTarget.position[1] - currentPosition.current[1], 2) +
          Math.pow(cameraTarget.position[2] - currentPosition.current[2], 2)
      )

      const lookAtDistance = Math.sqrt(
        Math.pow(cameraTarget.lookAt[0] - currentLookAt.current[0], 2) +
          Math.pow(cameraTarget.lookAt[1] - currentLookAt.current[1], 2) +
          Math.pow(cameraTarget.lookAt[2] - currentLookAt.current[2], 2)
      )

      // Animation complete when both position and look-at are close enough
      if (positionDistance < 0.08 && lookAtDistance < 0.08) {
        isAnimating.current = false
        isLocked.current = focusedSphere !== null
        onAnimationComplete()
      }
    } else if (
      isLocked.current &&
      focusedSphere &&
      spheres.length > 0 &&
      cameraMode !== 'transitioning'
    ) {
      // ULTRA-CLOSE SPHERE POSITIONING SYSTEM
      const sphere = spheres.find((s) => s.id === focusedSphere)
      if (sphere) {
        // Sphere coordinates
        const sphereX = sphere.x
        const sphereY = sphere.y
        const sphereZ = sphere.z

        // ULTRA-CLOSE DISTANCE: Much closer than 5 units
        // Options: 0.5, 0.8, 1.0, 1.5 units for very close positioning
        const ULTRA_CLOSE_DISTANCE = 0.8 // Very close - almost touching the sphere

        // PERFECT SYMMETRY: Camera X and Y match sphere X and Y exactly
        const cameraX = sphereX // SAME X as sphere for perfect horizontal centering
        const cameraY = sphereY // SAME Y as sphere for perfect vertical centering
        const cameraZ = sphereZ + ULTRA_CLOSE_DISTANCE // Ultra-close distance

        // Set camera to EXACT position for ultra-close sphere viewing
        camera.position.set(cameraX, cameraY, cameraZ)
        camera.lookAt(sphereX, sphereY, sphereZ)

        // Debug logging for verification
        console.log(`Ultra-Close Positioning:`)
        console.log(`Sphere: (${sphereX}, ${sphereY}, ${sphereZ})`)
        console.log(`Camera: (${cameraX}, ${cameraY}, ${cameraZ})`)
        console.log(`Distance: ${ULTRA_CLOSE_DISTANCE} units (ULTRA-CLOSE)`)
      }
    } else {
      // Default camera behavior with ultra-smooth movement
      const defaultPosition: [number, number, number] = [
        0,
        3,
        8 - (modelScale - 1.5) * 1.5,
      ]
      const defaultLookAt: [number, number, number] = [0, 0, 0]
      const defaultLerpFactor = fps > 45 ? 0.015 : 0.01

      currentPosition.current[0] +=
        (defaultPosition[0] - currentPosition.current[0]) * defaultLerpFactor
      currentPosition.current[1] +=
        (defaultPosition[1] - currentPosition.current[1]) * defaultLerpFactor
      currentPosition.current[2] +=
        (defaultPosition[2] - currentPosition.current[2]) * defaultLerpFactor

      currentLookAt.current[0] +=
        (defaultLookAt[0] - currentLookAt.current[0]) * defaultLerpFactor
      currentLookAt.current[1] +=
        (defaultLookAt[1] - currentLookAt.current[1]) * defaultLerpFactor
      currentLookAt.current[2] +=
        (defaultLookAt[2] - currentLookAt.current[2]) * defaultLerpFactor

      camera.position.set(...currentPosition.current)
      camera.lookAt(...currentLookAt.current)
    }
  })

  return null
}

// LOD-Optimized 3D Model Component (No Rotation)
function LODTinyHouseModel({
  scale,
  spheres = [],
  focusedSphere,
}: {
  scale: number
  spheres?: SpherePosition[]
  focusedSphere: number | null
}) {
  const meshRef = useRef<Group>(null)

  // Load the 3D model
  const { scene } = useGLTF('/tiny_home/Tiny_House.glb')

  // No rotation logic - house stays in fixed orientation

  return (
    <group ref={meshRef} scale={[scale, scale, scale]} position={[0, -5, -10]}>
      {/* House Model - Fixed orientation */}
      <primitive object={scene} />

      {/* LOD-Optimized Spheres */}
      {spheres.map((sphere) => (
        <LODPositioningSphere
          key={sphere.id}
          position={[sphere.x, sphere.y, sphere.z]}
          color={sphere.color}
          visible={sphere.visible}
          sphereId={sphere.id}
          focusedSphere={focusedSphere}
        />
      ))}
    </group>
  )
}

export default function UltraCloseSphereCamera() {
  // Simplified state management - scroll-based scaling only
  const [scrollProgress, setScrollProgress] = useState<number>(0)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [showSphereControls, setShowSphereControls] = useState<boolean>(false)
  const [selectedSphere, setSelectedSphere] = useState<number | null>(null)
  const [notificationShown, setNotificationShown] = useState<boolean>(false)

  // Camera and animation states
  const [cameraTarget, setCameraTarget] = useState<{
    position: [number, number, number]
    lookAt: [number, number, number]
    animating: boolean
  }>({
    position: [0, 3, 8],
    lookAt: [0, 0, 0],
    animating: false,
  })
  const [notificationText, setNotificationText] = useState<string>('')
  const [showNotification, setShowNotification] = useState<boolean>(false)
  const [focusedSphere, setFocusedSphere] = useState<number | null>(null)

  // Simplified camera mode (no complex transitions)
  const [cameraMode, setCameraMode] = useState<
    'overview' | 'focused' | 'transitioning'
  >('overview')

  // Dropdown states
  const [dropdownStates, setDropdownStates] = useState({
    Living_Room: false,
    Kitchen: false,
    Bedroom: false,
    Bathroom: false,
  })

  // Menu data and spheres initialization
  const menuData: {
    Living_Room: string[]
    Kitchen: string[]
    Bedroom: string[]
    Bathroom: string[]
  } = {
    Living_Room: ['Samsung TV', 'LED lights', 'Videogame', 'Carpet'],
    Kitchen: ['Oven', 'Microwave', 'Mixer', 'Cooktop'],
    Bedroom: ['Bed', 'Rug', 'Desk', 'Chair'],
    Bathroom: ['Shower', 'Toilet', 'LED lights', 'Towell Hanger'],
  }

  const [spheres, setSpheres] = useState<SpherePosition[]>(() => {
    const allAppliances = [
      ...menuData.Living_Room,
      ...menuData.Kitchen,
      ...menuData.Bedroom,
      ...menuData.Bathroom,
    ]

    const specificCoordinates = [
      { x: -1.2, y: 2.4, z: 1.8 }, // Samsung TV
      { x: -1.1, y: 2.6, z: 0.9 }, // LED lights
      { x: -1.3, y: 2.2, z: 1.7 }, // Videogame
      { x: -0.4, y: 0.1, z: 1.5 }, // Carpet
      { x: -0.2, y: 0.4, z: -1.7 }, // Oven
      { x: -0.6, y: 0.6, z: -1.7 }, // Microwave
      { x: 0.5, y: 0.6, z: -1.7 }, // Mixer
      { x: -0.1, y: 0.7, z: -1.7 }, // Cooktop
      { x: 0.42, y: 2.1, z: 1.7 }, // Bed
      { x: -0.6, y: 2.1, z: 1.7 }, // Rug
      { x: 1.3, y: 2.2, z: 1.7 }, // Desk
      { x: 1.2, y: 2.2, z: 1.2 }, // Chair
      { x: 1.5, y: 0.8, z: -1.8 }, // Shower
      { x: 1.7, y: 0.3, z: -0.7 }, // Toilet
      { x: 1.4, y: 1.3, z: 0.1 }, // LED lights (bathroom)
      { x: 0.9, y: 0.8, z: -0.6 }, // Towell Hanger
    ]

    const colors = [
      '#ff6b6b',
      '#4ecdc4',
      '#45b7d1',
      '#96ceb4',
      '#feca57',
      '#ff9ff3',
      '#54a0ff',
      '#5f27cd',
      '#00d2d3',
      '#ff9f43',
      '#ee5a24',
      '#0abde3',
      '#10ac84',
      '#f368e0',
      '#3742fa',
      '#2f3542',
    ]

    return Array.from({ length: 16 }, (_, index) => ({
      id: index + 1,
      x: specificCoordinates[index].x,
      y: specificCoordinates[index].y,
      z: specificCoordinates[index].z,
      visible: true,
      color: colors[index],
      name: allAppliances[index],
    }))
  })

  // Calculate smooth model scale based on scroll progress (0-100%)
  const modelScale = 1.0 + scrollProgress * 2.0 // Scale from 1.0 to 3.0

  // Calculate title opacity (fades out as we scroll)
  const titleOpacity = Math.max(1 - scrollProgress * 2, 0) // Fades out faster

  // Calculate sidebar visibility (appears after 50% scroll)
  const sidebarThreshold = 0.5 // 50% of scroll progress
  const shouldShowSidebar = scrollProgress >= sidebarThreshold

  // Scroll-based scaling (no rotation)
  useEffect(() => {
    const handleScroll = (): void => {
      const scrollTop = window.pageYOffset
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = Math.min(scrollTop / docHeight, 1)

      setScrollProgress(scrollPercent)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Update sidebar visibility based on scroll progress
  useEffect(() => {
    // Show sidebar and spheres when scroll threshold is reached
    if (shouldShowSidebar && !sidebarOpen) {
      setSidebarOpen(true)
      setShowSphereControls(true)

      if (!notificationShown) {
        setNotificationText('Sidebar and spheres activated!')
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 2000)
        setNotificationShown(true)
      }
    } else if (!shouldShowSidebar && sidebarOpen) {
      setSidebarOpen(false)
      setShowSphereControls(false)
    }
  }, [scrollProgress, shouldShowSidebar, sidebarOpen, notificationShown])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && sidebarOpen) {
        closeSidebar()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  const closeSidebar = (): void => {
    setSidebarOpen(false)
    setShowSphereControls(false)
    setSelectedSphere(null)
    setDropdownStates({
      Living_Room: false,
      Kitchen: false,
      Bedroom: false,
      Bathroom: false,
    })
  }

  const toggleDropdown = (item: string): void => {
    setDropdownStates((prev) => ({
      ...prev,
      [item]: !prev[item as keyof typeof prev],
    }))
  }

  // Ultra-close sphere-to-sphere camera transitions with minimal distance
  const zoomToSphere = (sphereId: number): void => {
    const sphere = spheres.find((s) => s.id === sphereId)
    if (!sphere) return

    // Always perform ultra-close zoom to sphere with perfect centering
    performUltraCloseZoomToSphere(sphereId)
  }

  const performUltraCloseZoomToSphere = (sphereId: number): void => {
    const sphere = spheres.find((s) => s.id === sphereId)
    if (!sphere) return

    // Sphere coordinates
    const sphereX = sphere.x
    const sphereY = sphere.y
    const sphereZ = sphere.z

    // ULTRA-CLOSE POSITIONING SYSTEM:
    // Camera X and Y match sphere X and Y exactly for perfect symmetry
    // Camera Z is very close to sphere - much less than 5 units
    const ULTRA_CLOSE_DISTANCE = 0.8 // Much closer - almost touching the sphere!

    const cameraX = sphereX // SAME X as sphere for perfect horizontal centering
    const cameraY = sphereY // SAME Y as sphere for perfect vertical centering
    const cameraZ = sphereZ + ULTRA_CLOSE_DISTANCE // Ultra-close distance

    setCameraTarget({
      position: [cameraX, cameraY, cameraZ],
      lookAt: [sphereX, sphereY, sphereZ],
      animating: true,
    })

    setFocusedSphere(sphereId)
    setCameraMode('focused')
    setNotificationText(`Ultra-close to ${sphere.name} (0.8 units away)`)
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 3000)

    // Debug logging
    console.log(`Ultra-Close Zoom to ${sphere.name}:`)
    console.log(`Sphere Position: (${sphereX}, ${sphereY}, ${sphereZ})`)
    console.log(`Camera Position: (${cameraX}, ${cameraY}, ${cameraZ})`)
    console.log(`Distance: ${ULTRA_CLOSE_DISTANCE} units (ULTRA-CLOSE!)`)
    console.log(`Perfect X/Y Alignment: Camera matches sphere coordinates`)
  }

  const resetCamera = (): void => {
    setCameraTarget({
      position: [0, 3, 8 - (modelScale - 1.5) * 1.5],
      lookAt: [0, 0, 0],
      animating: true,
    })

    setFocusedSphere(null)
    setCameraMode('overview')
    setNotificationText('Returned to overview')
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  const handleAnimationComplete = (): void => {
    // Simplified - no complex transition phases
    console.log('Ultra-close positioning animation completed')
  }

  const updateSpherePosition = (
    id: number,
    axis: 'x' | 'y' | 'z',
    value: number
  ): void => {
    setSpheres((prev) =>
      prev.map((sphere) =>
        sphere.id === id ? { ...sphere, [axis]: value } : sphere
      )
    )
  }

  const toggleSphereVisibility = (id: number): void => {
    setSpheres((prev) =>
      prev.map((sphere) =>
        sphere.id === id ? { ...sphere, visible: !sphere.visible } : sphere
      )
    )
  }

  const resetSpherePosition = (id: number): void => {
    setSpheres((prev) =>
      prev.map((sphere) =>
        sphere.id === id
          ? {
              ...sphere,
              x: (Math.random() - 0.5) * 16,
              y: Math.random() * 8 - 2,
              z: (Math.random() - 0.5) * 16,
            }
          : sphere
      )
    )
  }

  const resetAllSpheres = (): void => {
    setSpheres((prev) =>
      prev.map((sphere) => ({
        ...sphere,
        x: (Math.random() - 0.5) * 16,
        y: Math.random() * 8 - 2,
        z: (Math.random() - 0.5) * 16,
      }))
    )
  }

  const exportCoordinates = (): void => {
    console.log('Sphere Coordinates:', JSON.stringify(spheres, null, 2))
    setNotificationText('Coordinates exported to console')
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  return (
    <div className="relative min-h-[300vh] bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-x-hidden">
      {/* Progress indicator */}
      <div className="fixed top-6 left-6 z-30 px-4 py-2 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl text-white text-sm">
        <div className="flex items-center space-x-3">
          <span className="text-cyan-300 font-mono">
            {(scrollProgress * 100).toFixed(0)}% Zoom
          </span>
          {scrollProgress > 0.3 && (
            <>
              <span className="text-white/50">•</span>
              <span className="text-emerald-300">Ultra-Smooth Scaling</span>
            </>
          )}
          {shouldShowSidebar && (
            <>
              <span className="text-white/50">•</span>
              <span className="text-cyan-300">Ultra-Close Camera</span>
            </>
          )}
        </div>
      </div>

      {/* Notification */}
      {showNotification && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 px-6 py-3 bg-emerald-500/90 backdrop-blur-md border border-emerald-400/50 rounded-xl text-white text-sm shadow-xl shadow-emerald-500/25">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>{notificationText}</span>
          </div>
        </div>
      )}

      {/* Hero Section with smaller title positioned at top */}
      <div className="fixed top-0 left-0 w-full h-screen flex items-start justify-center z-5 pointer-events-none">
        <div className="relative w-full h-full px-4">
          <div
            className="absolute top-16 left-1/2 transform -translate-x-1/2 text-center z-10 transition-opacity duration-1000"
            style={{ opacity: titleOpacity }}
          >
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3 leading-tight">
              Tiny Homes
            </h1>
            <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Ultra-Close Camera System
            </p>
            <p className="text-white/50 text-xs mt-1">
              Scroll to zoom • 0.8-unit ultra-close positioning
            </p>
          </div>

          {/* 3D Canvas */}
          <Canvas
            camera={{
              position: [0, 3, 8],
              fov: 45,
            }}
            style={{
              background: 'transparent',
              width: '100%',
              height: '100%',
            }}
          >
            <Suspense fallback={null}>
              {/* Ultra-Close Camera Animation with Minimal Distance */}
              <UltraCloseCameraAnimation
                cameraTarget={cameraTarget}
                modelScale={modelScale}
                onAnimationComplete={handleAnimationComplete}
                focusedSphere={focusedSphere}
                spheres={spheres}
                cameraMode={cameraMode}
              />

              {/* Adaptive Lighting */}
              <ambientLight intensity={0.6 + (modelScale - 1.0) * 0.1} />
              <directionalLight
                position={[15, 15, 8]}
                intensity={1.4 + (modelScale - 1.0) * 0.2}
                castShadow
              />
              <directionalLight
                position={[-15, 8, -8]}
                intensity={1.0 + (modelScale - 1.0) * 0.1}
              />
              <pointLight
                position={[0, 12, 0]}
                intensity={0.8 + (modelScale - 1.0) * 0.1}
              />
              <pointLight
                position={[8, -8, 8]}
                intensity={0.5}
                color="#00ffff"
              />
              <pointLight
                position={[-8, -8, -8]}
                intensity={0.4}
                color="#ff00ff"
              />

              <Environment preset="sunset" />

              {/* LOD-Optimized 3D Model (No Rotation) */}
              <group>
                <LODTinyHouseModel
                  scale={modelScale}
                  spheres={showSphereControls ? spheres : []}
                  focusedSphere={focusedSphere}
                />
              </group>

              <OrbitControls
                enabled={false}
                enableZoom={false}
                enablePan={false}
                enableRotate={false}
              />
            </Suspense>
          </Canvas>

          {/* Floating elements */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-cyan-400/30 rounded-full animate-pulse"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 2) * 40}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${2 + i * 0.3}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Original Sidebar Style with glassmorphism */}
      <div
        className={`fixed top-20 right-5 w-80 bg-white/[0.08] backdrop-blur-xl border border-white/15 rounded-3xl z-40 transform transition-all duration-500 ${
          sidebarOpen
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full opacity-0'
        }`}
      >
        <div className="p-6 h-full max-h-[calc(100vh-120px)] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Ultra-Close Navigation
            </h2>
            <button
              onClick={closeSidebar}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {/* Navigation Menu with Original Style */}
          <div className="space-y-3 mb-6">
            {Object.entries(menuData).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <button
                  onClick={() => toggleDropdown(category)}
                  className="w-full flex items-center justify-between p-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-200"
                >
                  <span className="text-white/90 font-medium text-sm">
                    {category.replace('_', ' ')}
                  </span>
                  {dropdownStates[category as keyof typeof dropdownStates] ? (
                    <ChevronUp className="w-4 h-4 text-white/70" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/70" />
                  )}
                </button>

                {dropdownStates[category as keyof typeof dropdownStates] && (
                  <div className="ml-3 space-y-1">
                    {items.map((subItem) => {
                      const sphereId =
                        spheres.findIndex((s) => s.name === subItem) + 1
                      return (
                        <div
                          key={subItem}
                          onClick={() => {
                            console.log(
                              `Clicked dropdown item: ${subItem}, sphere ID: ${sphereId}`
                            )
                            if (sphereId > 0) {
                              zoomToSphere(sphereId)
                              setSelectedSphere(sphereId)
                            }
                          }}
                          className="flex items-center p-2 bg-white/[0.04] hover:bg-white/[0.12] rounded-xl border border-white/[0.08] hover:border-white/20 transition-all duration-200 cursor-pointer group"
                          style={{
                            backgroundColor:
                              sphereId > 0
                                ? spheres[sphereId - 1]?.color + '60'
                                : '#06b6d4',
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full mr-2 border border-white/30"
                            style={{
                              backgroundColor:
                                sphereId > 0
                                  ? spheres[sphereId - 1]?.color
                                  : '#06b6d4',
                            }}
                          />
                          <span className="text-xs text-white/90 group-hover:text-white">
                            {subItem}
                          </span>
                          {focusedSphere === sphereId && (
                            <span className="text-xs text-cyan-300 ml-auto">
                              🎯
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Camera Controls */}
          {showSphereControls && (
            <div className="border-t border-white/20 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Ultra-Close Controls
                </h3>
                <button
                  onClick={resetCamera}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white/80 transition-colors duration-200"
                >
                  Reset View
                </button>
              </div>

              <div className="text-xs text-white/60 mb-4">
                Click any appliance above for ultra-close 0.8-unit positioning
              </div>

              {/* Sphere Controls */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white/90">
                    Sphere Controls
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={exportCoordinates}
                      className="px-2 py-1 bg-emerald-500/20 border border-emerald-400/50 rounded text-xs text-emerald-300 hover:bg-emerald-500/30 transition-all duration-200"
                    >
                      Export
                    </button>
                    <button
                      onClick={resetAllSpheres}
                      className="px-2 py-1 bg-red-500/20 border border-red-400/50 rounded text-xs text-red-300 hover:bg-red-500/30 transition-all duration-200"
                    >
                      Reset All
                    </button>
                  </div>
                </div>

                {spheres.map((sphere) => (
                  <div
                    key={sphere.id}
                    className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                      selectedSphere === sphere.id
                        ? 'bg-white/15 border-white/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                    onClick={() => {
                      if (selectedSphere === sphere.id) {
                        setSelectedSphere(null)
                        resetCamera()
                      } else {
                        setSelectedSphere(sphere.id)
                        zoomToSphere(sphere.id)
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full border border-white/30"
                          style={{ backgroundColor: sphere.color }}
                        />
                        <span className="text-white/90 text-xs font-medium">
                          {sphere.name}
                        </span>
                        {focusedSphere === sphere.id && (
                          <span className="text-xs text-cyan-300">🎯</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSphereVisibility(sphere.id)
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors duration-200"
                      >
                        {sphere.visible ? (
                          <Eye className="w-3 h-3 text-white/70" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-white/40" />
                        )}
                      </button>
                    </div>

                    {selectedSphere === sphere.id && (
                      <div className="mt-3 space-y-2 border-t border-white/10 pt-2">
                        <div className="text-xs text-white/60">
                          Position: ({sphere.x.toFixed(2)},{' '}
                          {sphere.y.toFixed(2)}, {sphere.z.toFixed(2)})
                        </div>
                        <div className="text-xs text-cyan-300">
                          Camera: ({sphere.x.toFixed(2)}, {sphere.y.toFixed(2)},{' '}
                          {(sphere.z + 0.8).toFixed(2)}) • 0.8 units away
                          (ULTRA-CLOSE!)
                        </div>

                        {/* Position Controls */}
                        {(['x', 'y', 'z'] as const).map((axis) => (
                          <div key={axis} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-white/70 uppercase font-medium">
                                {axis}
                              </label>
                              <span className="text-xs text-white/60 font-mono">
                                {sphere[axis].toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={axis === 'y' ? -2 : -8}
                              max={axis === 'y' ? 6 : 8}
                              step="0.1"
                              value={sphere[axis]}
                              onChange={(e) =>
                                updateSpherePosition(
                                  sphere.id,
                                  axis,
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        ))}

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            resetSpherePosition(sphere.id)
                          }}
                          className="w-full mt-2 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white/80 transition-colors duration-200 flex items-center justify-center space-x-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scroll content */}
      <div className="relative z-10 pt-[100vh]">
        <div className="h-[200vh] bg-gradient-to-b from-transparent to-slate-900/50" />
      </div>
    </div>
  )
}
