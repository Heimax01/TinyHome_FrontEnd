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

  // Calculate LOD based on distance and focus state
  const lod = useDistanceLOD(position, camera, focusedSphere, sphereId)

  // Performance-based quality adjustment
  const fps = usePerformanceMonitor()
  const performanceAdjustment = useMemo(() => {
    if (fps < 30) return 0.5 // Reduce quality significantly
    if (fps < 45) return 0.75 // Reduce quality moderately
    return 1.0 // Full quality
  }, [fps])

  // Adjust geometry detail based on performance
  const finalGeometryDetail = useMemo(
    () => ({
      widthSegments: Math.max(
        4,
        Math.floor(lod.geometryDetail.widthSegments * performanceAdjustment)
      ),
      heightSegments: Math.max(
        4,
        Math.floor(lod.geometryDetail.heightSegments * performanceAdjustment)
      ),
    }),
    [lod.geometryDetail, performanceAdjustment]
  )

  // Calculate opacity based on distance and performance (MOVED BEFORE EARLY RETURN)
  const opacity = useMemo(() => {
    const baseOpacity = 0.9
    const distanceOpacity =
      lod.detail === 'high' ? 1.0 : lod.detail === 'medium' ? 0.8 : 0.6
    return baseOpacity * distanceOpacity * performanceAdjustment
  }, [lod, performanceAdjustment])

  useFrame((state) => {
    if (meshRef.current && visible && lod.visible) {
      // Only animate floating if LOD allows it and performance is good
      if (lod.showFloating && fps > 45) {
        meshRef.current.position.set(
          position[0],
          position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05,
          position[2]
        )
      } else {
        // Static position for better performance
        meshRef.current.position.set(position[0], position[1], position[2])
      }
    }
  })

  // Don't render if not visible or too far away
  if (!visible || !lod.visible) return null

  return (
    <group ref={meshRef}>
      {/* Main sphere with LOD geometry */}
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
          emissiveIntensity={
            lod.detail === 'high' ? 0.3 : lod.detail === 'medium' ? 0.2 : 0.1
          }
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

// LOD-Optimized Camera Animation Component
function LODStaticCameraAnimation({
  cameraTarget,
  modelScale,
  onAnimationComplete,
  focusedSphere,
  spheres,
  targetRotation,
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
  targetRotation: number
  cameraMode: 'overview' | 'focused' | 'transitioning'
}) {
  const { camera } = useThree()
  const currentPosition = useRef<[number, number, number]>([0, 3, 8])
  const currentLookAt = useRef<[number, number, number]>([0, 0, 0])
  const isAnimating = useRef<boolean>(false)
  const isLocked = useRef<boolean>(false)

  // Performance monitoring for adaptive quality
  const fps = usePerformanceMonitor()

  // Adaptive animation quality based on performance and transition type
  const animationQuality = useMemo(() => {
    if (fps < 30) return { lerpFactor: 0.15, updateFrequency: 2 } // Slower for performance
    if (fps < 45) return { lerpFactor: 0.12, updateFrequency: 1 } // Moderate quality
    return { lerpFactor: 0.1, updateFrequency: 1 } // Smooth quality for zoom in
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
        camera.position.x,
        camera.position.y,
        camera.position.z - 1, // Look forward from current position
      ]
      isAnimating.current = true
      console.log(
        'Starting camera animation from:',
        currentPosition.current,
        'to:',
        cameraTarget.position
      )
    }

    if (cameraTarget.animating || isAnimating.current) {
      // Use adaptive lerp factor for smooth animation
      const lerpFactor = animationQuality.lerpFactor

      // Animate position
      currentPosition.current[0] +=
        (cameraTarget.position[0] - currentPosition.current[0]) * lerpFactor
      currentPosition.current[1] +=
        (cameraTarget.position[1] - currentPosition.current[1]) * lerpFactor
      currentPosition.current[2] +=
        (cameraTarget.position[2] - currentPosition.current[2]) * lerpFactor

      // Animate look at target
      currentLookAt.current[0] +=
        (cameraTarget.lookAt[0] - currentLookAt.current[0]) * lerpFactor
      currentLookAt.current[1] +=
        (cameraTarget.lookAt[1] - currentLookAt.current[1]) * lerpFactor
      currentLookAt.current[2] +=
        (cameraTarget.lookAt[2] - currentLookAt.current[2]) * lerpFactor

      // Apply camera position and rotation
      camera.position.set(...currentPosition.current)
      camera.lookAt(...currentLookAt.current)

      // Check if animation is complete (closer threshold for smoother transitions)
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
      if (positionDistance < 0.05 && lookAtDistance < 0.05) {
        console.log(
          'Animation complete - position distance:',
          positionDistance,
          'lookAt distance:',
          lookAtDistance
        )
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
      // Static lock mode - camera stays perfectly centered on sphere
      // BUT ONLY if we're not in transition mode to prevent returning to old sphere
      const sphere = spheres.find((s) => s.id === focusedSphere)
      if (sphere) {
        const worldX =
          sphere.x * Math.cos(targetRotation) -
          sphere.z * Math.sin(targetRotation)
        const worldZ =
          sphere.x * Math.sin(targetRotation) +
          sphere.z * Math.cos(targetRotation)
        const worldY = sphere.y

        const distance = 0.8
        const height = 0.3

        const angle = Math.atan2(worldZ, worldX) + Math.PI / 4
        const staticCameraX = worldX + distance * Math.cos(angle)
        const staticCameraY = worldY + height
        const staticCameraZ = worldZ + distance * Math.sin(angle)

        camera.position.set(staticCameraX, staticCameraY, staticCameraZ)
        camera.lookAt(worldX, worldY, worldZ)
      }
    } else if (!isLocked.current) {
      // Default overview mode
      const defaultPosition: [number, number, number] = [
        0,
        3,
        8 - (modelScale - 1.5) * 1.5,
      ]

      const defaultLerpFactor = fps > 45 ? 0.02 : 0.01

      currentPosition.current[0] +=
        (defaultPosition[0] - currentPosition.current[0]) * defaultLerpFactor
      currentPosition.current[1] +=
        (defaultPosition[1] - currentPosition.current[1]) * defaultLerpFactor
      currentPosition.current[2] +=
        (defaultPosition[2] - currentPosition.current[2]) * defaultLerpFactor

      currentLookAt.current[0] +=
        (0 - currentLookAt.current[0]) * defaultLerpFactor
      currentLookAt.current[1] +=
        (0 - currentLookAt.current[1]) * defaultLerpFactor
      currentLookAt.current[2] +=
        (0 - currentLookAt.current[2]) * defaultLerpFactor

      camera.position.set(...currentPosition.current)
      camera.lookAt(...currentLookAt.current)
    }
  })

  useEffect(() => {
    if (focusedSphere === null) {
      isLocked.current = false
    }
  }, [focusedSphere])

  return null
}

// LOD-Optimized 3D Model Component
function LODTinyHouseModel({
  targetRotation,
  scale,
  spheres = [],
  focusedSphere,
}: {
  targetRotation: number
  scale: number
  spheres?: SpherePosition[]
  focusedSphere: number | null
}) {
  const { scene } = useGLTF('/tiny_home/Tiny_House.glb')
  const meshRef = useRef<Group>(null)
  const currentRotation = useRef<number>(0)
  const velocity = useRef<number>(0)
  const { camera } = useThree()

  // Performance monitoring
  const fps = usePerformanceMonitor()

  // Calculate house LOD based on camera distance and scale
  const houseLOD = useMemo(() => {
    const housePosition = new ThreeVector3(0, -1.2, 0)
    const distance = camera.position.distanceTo(housePosition)
    const effectiveDistance = distance / scale

    if (effectiveDistance < 3 || focusedSphere !== null) return 'high'
    if (effectiveDistance < 8) return 'medium'
    return 'low'
  }, [camera.position, scale, focusedSphere])

  // Adaptive rotation quality based on performance
  const rotationQuality = useMemo(() => {
    if (fps < 30) return { lerpFactor: 0.12, momentum: 0.01, damping: 0.9 }
    if (fps < 45) return { lerpFactor: 0.1, momentum: 0.015, damping: 0.87 }
    return { lerpFactor: 0.08, momentum: 0.02, damping: 0.85 }
  }, [fps])

  useFrame(() => {
    if (meshRef.current) {
      const difference = targetRotation - currentRotation.current

      // Use adaptive quality settings
      velocity.current += difference * rotationQuality.momentum
      velocity.current *= rotationQuality.damping

      currentRotation.current +=
        difference * rotationQuality.lerpFactor + velocity.current * 0.1

      meshRef.current.rotation.y = currentRotation.current
    }
  })

  // Filter visible spheres based on performance
  const visibleSpheres = useMemo(() => {
    if (fps < 30) {
      // Show only focused sphere and nearby spheres when performance is poor
      return spheres.filter(
        (sphere) =>
          sphere.id === focusedSphere || (sphere.visible && Math.random() < 0.3) // Randomly show 30% of other spheres
      )
    }
    return spheres.filter((sphere) => sphere.visible)
  }, [spheres, focusedSphere, fps])

  return (
    <group ref={meshRef} scale={[scale, scale, scale]} position={[0, -1.2, 0]}>
      {/* House Model - could be swapped for different LOD versions */}
      <primitive object={scene} />

      {/* LOD-Optimized Spheres */}
      {visibleSpheres.map((sphere) => (
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

export default function LODOptimizedScene() {
  // All existing state management...
  const [scrollY, setScrollY] = useState<number>(0)
  const [targetRotation, setTargetRotation] = useState<number>(0)
  const [modelScale, setModelScale] = useState<number>(1.5)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [rotationDegrees, setRotationDegrees] = useState<number>(0)
  const [showSphereControls, setShowSphereControls] = useState<boolean>(false)
  const [selectedSphere, setSelectedSphere] = useState<number | null>(null)
  const [notificationShown, setNotificationShown] = useState<boolean>(false)

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

  // Enhanced transition system for zoom out → zoom in
  const [cameraMode, setCameraMode] = useState<
    'overview' | 'focused' | 'transitioning'
  >('overview')
  const [pendingTarget, setPendingTarget] = useState<number | null>(null)
  const [transitionPhase, setTransitionPhase] = useState<
    'zoom_out' | 'zoom_in' | 'none'
  >('none')

  // Performance monitoring state
  const [performanceMode, setPerformanceMode] = useState<
    'auto' | 'high' | 'medium' | 'low'
  >('auto')

  // Menu data and spheres initialization (same as before)
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

  const [dropdownStates, setDropdownStates] = useState<{
    Living_Room: boolean
    Kitchen: boolean
    Bedroom: boolean
    Bathroom: boolean
  }>({
    Living_Room: false,
    Kitchen: false,
    Bedroom: false,
    Bathroom: false,
  })

  // Wheel-based rotation handling (same as before)
  useEffect(() => {
    let accumulatedDegrees = 0
    let isScrolling = false
    let scrollTimeout: NodeJS.Timeout

    const handleWheel = (e: WheelEvent): void => {
      e.preventDefault()

      const degreesPerScroll = 1.2
      const scrollDirection = e.deltaY > 0 ? 1 : -1

      accumulatedDegrees += scrollDirection * degreesPerScroll

      const targetRadians = (accumulatedDegrees * Math.PI) / 180
      setTargetRotation(targetRadians)

      const displayDegrees = Math.abs(accumulatedDegrees) % 360
      setRotationDegrees(displayDegrees)

      isScrolling = true
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        isScrolling = false
      }, 200)

      let newModelScale: number
      if (displayDegrees < 30) {
        newModelScale = 1.5
      } else if (displayDegrees < 60) {
        const scaleProgress = (displayDegrees - 30) / 30
        newModelScale = 1.5 + scaleProgress * 1.3
      } else {
        newModelScale = 2.8
      }
      setModelScale(newModelScale)

      if (displayDegrees >= 60 && !sidebarOpen) {
        setSidebarOpen(true)
        setShowSphereControls(true)

        if (!notificationShown) {
          setShowNotification(true)
          setTimeout(() => {
            setShowNotification(false)
          }, 3000)
          setNotificationShown(true)
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      clearTimeout(scrollTimeout)
    }
  }, [sidebarOpen, notificationShown])

  // ESC key handler and other functions (same as before)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && sidebarOpen) {
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
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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

  const zoomToSphere = (sphereId: number): void => {
    const sphere = spheres.find((s) => s.id === sphereId)
    if (!sphere) return

    console.log(`Zooming to sphere ${sphereId}: ${sphere.name}`, sphere)

    // Check if we're already focused on a different sphere
    if (focusedSphere && focusedSphere !== sphereId) {
      console.log(
        `Switching from sphere ${focusedSphere} to ${sphereId} - initiating zoom out → zoom in`
      )

      // Set transition state FIRST to prevent camera lock issues
      setCameraMode('transitioning')
      setPendingTarget(sphereId)
      setTransitionPhase('zoom_out')

      // IMPORTANT: Clear focused sphere to prevent camera from locking back to old sphere
      setFocusedSphere(null)

      // First, zoom out to overview position
      setCameraTarget({
        position: [0, 3, 8 - (modelScale - 1.5) * 1.5],
        lookAt: [0, 0, 0],
        animating: true,
      })

      setNotificationText(
        `Transitioning from ${
          spheres.find((s) => s.id === focusedSphere)?.name
        } to ${sphere.name}...`
      )
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)

      return // Exit here, the zoom in will happen in handleAnimationComplete
    }

    // Direct zoom to sphere (first time or from overview)
    performZoomToSphere(sphereId)
  }

  const performZoomToSphere = (sphereId: number): void => {
    const sphere = spheres.find((s) => s.id === sphereId)
    if (!sphere) return

    const worldX =
      sphere.x * Math.cos(targetRotation) - sphere.z * Math.sin(targetRotation)
    const worldZ =
      sphere.x * Math.sin(targetRotation) + sphere.z * Math.cos(targetRotation)
    const worldY = sphere.y

    const distance = 0.8
    const height = 0.3

    const angle = Math.atan2(worldZ, worldX) + Math.PI / 4
    const cameraX = worldX + distance * Math.cos(angle)
    const cameraY = worldY + height
    const cameraZ = worldZ + distance * Math.sin(angle)

    console.log('Camera target for perfect centering:', {
      position: [cameraX, cameraY, cameraZ],
      lookAt: [worldX, worldY, worldZ],
      sphereWorld: { worldX, worldY, worldZ },
    })

    setCameraTarget({
      position: [cameraX, cameraY, cameraZ],
      lookAt: [worldX, worldY, worldZ],
      animating: true,
    })

    setFocusedSphere(sphereId)
    setCameraMode('focused')
    setNotificationText(`Focused on ${sphere.name} - LOD Optimized & Locked`)
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  const resetCamera = (): void => {
    console.log('Resetting camera to overview')

    setCameraTarget({
      position: [0, 3, 8 - (modelScale - 1.5) * 1.5],
      lookAt: [0, 0, 0],
      animating: true,
    })

    setFocusedSphere(null)
    setCameraMode('overview')
    setTransitionPhase('none')
    setPendingTarget(null)
    setNotificationText('Returning to overview - LOD Optimized')
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  const handleAnimationComplete = (): void => {
    console.log('Animation complete - checking transition state:', {
      cameraMode,
      transitionPhase,
      pendingTarget,
    })

    setCameraTarget((prev) => ({ ...prev, animating: false }))

    // Handle zoom out → zoom in transition
    if (
      cameraMode === 'transitioning' &&
      transitionPhase === 'zoom_out' &&
      pendingTarget
    ) {
      console.log(
        `Zoom out complete, starting zoom in to sphere ${pendingTarget}`
      )

      // Brief pause before zooming in for smooth transition
      setTimeout(() => {
        console.log(`Initiating zoom in to sphere ${pendingTarget}`)
        setTransitionPhase('zoom_in')

        // Perform the zoom in animation
        const sphere = spheres.find((s) => s.id === pendingTarget)
        if (sphere) {
          const worldX =
            sphere.x * Math.cos(targetRotation) -
            sphere.z * Math.sin(targetRotation)
          const worldZ =
            sphere.x * Math.sin(targetRotation) +
            sphere.z * Math.cos(targetRotation)
          const worldY = sphere.y

          const distance = 0.8
          const height = 0.3

          const angle = Math.atan2(worldZ, worldX) + Math.PI / 4
          const cameraX = worldX + distance * Math.cos(angle)
          const cameraY = worldY + height
          const cameraZ = worldZ + distance * Math.sin(angle)

          console.log('Zoom in camera target:', {
            position: [cameraX, cameraY, cameraZ],
            lookAt: [worldX, worldY, worldZ],
          })

          // Set the zoom in target
          setCameraTarget({
            position: [cameraX, cameraY, cameraZ],
            lookAt: [worldX, worldY, worldZ],
            animating: true,
          })

          // Update states for the new focused sphere
          setFocusedSphere(pendingTarget)
          setCameraMode('focused')
          setNotificationText(
            `Focused on ${sphere.name} - LOD Optimized & Locked`
          )
          setShowNotification(true)
          setTimeout(() => setShowNotification(false), 2000)
        }

        // Clean up transition state
        setPendingTarget(null)
        setTransitionPhase('none')
      }, 400) // Slightly longer pause (400ms) for smoother visual transition
    }
  }

  // Sphere control functions (same as before)
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
      {/* Progress indicator with performance info */}
      <div className="fixed top-6 left-6 z-30 px-4 py-2 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl text-white text-sm">
        <div className="flex items-center space-x-3">
          <span className="text-cyan-300 font-mono">
            {rotationDegrees.toFixed(1)}°
          </span>
          {rotationDegrees >= 30 && (
            <>
              <span className="text-white/50">•</span>
              <span className="text-emerald-300">LOD Scaling Active</span>
            </>
          )}
          {rotationDegrees >= 60 && (
            <>
              <span className="text-white/50">•</span>
              <span className="text-cyan-300">16 LOD Spheres Active</span>
            </>
          )}
        </div>
      </div>

      {/* Performance indicator */}
      <div className="fixed top-6 right-6 z-30 px-3 py-2 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl text-white text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-white/70">Performance:</span>
          <span
            className={`font-mono ${
              // This will be updated by the performance monitor
              'text-emerald-300'
            }`}
          >
            LOD Active
          </span>
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

      {/* Hero Section */}
      <div className="fixed top-0 left-0 w-full h-screen flex items-center justify-center z-5 pointer-events-none">
        <div className="relative w-full h-full px-4">
          <div
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 transition-opacity duration-1000 ${
              rotationDegrees > 15 ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {rotationDegrees < 30 && (
              <div className="transition-opacity duration-500">
                <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-6 leading-tight">
                  Tiny Homes
                </h1>
                <p className="text-white/70 text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
                  LOD-Optimized 3D Experience
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 1 of 3: Introduction • Performance Optimized
                </p>
              </div>
            )}
            {rotationDegrees >= 30 && rotationDegrees < 60 && (
              <div className="transition-opacity duration-500">
                <p className="text-white/70 text-lg">
                  Adaptive LOD scaling active!
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 2 of 3: Dynamic quality adjustment
                </p>
              </div>
            )}
            {rotationDegrees >= 60 && (
              <div className="transition-opacity duration-500">
                <p className="text-white/70 text-lg">Full LOD system active!</p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 3 of 3: Maximum performance optimization
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar (same structure as before, but with LOD indicators) */}
      <div
        className={`fixed top-0 right-0 h-full w-96 z-20 transform transition-transform duration-700 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } bg-white/10 backdrop-blur-xl border-l border-white/20 shadow-2xl shadow-purple-500/20`}
      >
        <div className="relative h-full overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none" />

          <button
            onClick={closeSidebar}
            className="absolute top-6 right-6 z-30 p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 p-8 pt-20">
            <div className="mb-8">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6">
                LOD Navigation
              </h2>

              <nav className="space-y-3">
                {Object.entries(menuData).map(([item, subItems]) => (
                  <div key={item} className="relative">
                    <button
                      onClick={() => toggleDropdown(item)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 border border-transparent hover:border-white/20"
                    >
                      <span className="font-medium">
                        {item.replace('_', ' ')}
                      </span>
                      {dropdownStates[item as keyof typeof dropdownStates] ? (
                        <ChevronUp className="w-4 h-4 text-cyan-400 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/60 hover:text-cyan-400 transition-all duration-200" />
                      )}
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-500 ease-in-out ${
                        dropdownStates[item as keyof typeof dropdownStates]
                          ? 'max-h-96 opacity-100'
                          : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="mt-2 ml-4 space-y-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-xl">
                        {subItems.map((subItem, subIndex) => {
                          const sphereId =
                            spheres.findIndex((s) => s.name === subItem) + 1

                          return (
                            <div
                              key={subItem}
                              className="flex items-center space-x-3 px-3 py-2 rounded-md text-white/80 hover:text-white hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-500/20 transition-all duration-300 cursor-pointer border-l-2 border-transparent hover:border-cyan-400"
                              style={{
                                transitionDelay: dropdownStates[
                                  item as keyof typeof dropdownStates
                                ]
                                  ? `${subIndex * 100}ms`
                                  : '0ms',
                              }}
                              onClick={() => {
                                console.log(
                                  `Clicked dropdown item: ${subItem}, sphere ID: ${sphereId}`
                                )
                                if (sphereId > 0) {
                                  zoomToSphere(sphereId)
                                  setSelectedSphere(sphereId)
                                }
                              }}
                            >
                              <div
                                className="w-2 h-2 rounded-full hover:bg-cyan-400 transition-colors duration-200"
                                style={{
                                  backgroundColor:
                                    sphereId > 0
                                      ? spheres[sphereId - 1]?.color + '60'
                                      : '#06b6d4',
                                }}
                              />
                              <span className="text-sm">{subItem}</span>
                              {focusedSphere === sphereId && (
                                <span className="text-xs text-cyan-300 ml-auto">
                                  🎯 LOD
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* LOD Sphere Controls */}
            {showSphereControls && (
              <div className="border-t border-white/20 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    LOD Spheres
                  </h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={exportCoordinates}
                      className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/50 rounded-lg text-emerald-300 text-xs hover:bg-emerald-500/30 transition-all duration-200"
                    >
                      Export
                    </button>
                    <button
                      onClick={resetAllSpheres}
                      className="px-3 py-1 bg-red-500/20 border border-red-400/50 rounded-lg text-red-300 text-xs hover:bg-red-500/30 transition-all duration-200"
                    >
                      Reset All
                    </button>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/90 text-sm font-medium">
                      LOD Camera
                    </span>
                    <button
                      onClick={resetCamera}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white/80 transition-colors duration-200"
                    >
                      Reset View
                    </button>
                  </div>

                  <div className="text-xs text-white/60 mb-2">
                    {cameraMode === 'overview' &&
                      '🔍 Overview Mode - Adaptive LOD'}
                    {cameraMode === 'focused' && focusedSphere && (
                      <span className="text-cyan-300">
                        🎯 Locked:{' '}
                        {spheres.find((s) => s.id === focusedSphere)?.name} -
                        High LOD
                      </span>
                    )}
                    {cameraMode === 'transitioning' && (
                      <span className="text-orange-300">
                        🔄 Transitioning:{' '}
                        {transitionPhase === 'zoom_out'
                          ? 'Zooming Out...'
                          : 'Zooming In...'}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white/60">
                    Performance-optimized rendering with dynamic quality
                    adjustment
                  </p>
                </div>

                {/* Sphere List with LOD indicators */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {spheres.map((sphere) => (
                    <div
                      key={sphere.id}
                      className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                        selectedSphere === sphere.id
                          ? 'bg-white/20 border-white/30'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                      onClick={() => {
                        console.log(
                          `Clicked on sphere ${sphere.id}: ${sphere.name}`
                        )
                        if (selectedSphere === sphere.id) {
                          setSelectedSphere(null)
                        } else {
                          setSelectedSphere(sphere.id)
                          zoomToSphere(sphere.id)
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: sphere.color }}
                          />
                          <span className="text-white/90 text-sm font-medium">
                            {sphere.name}
                          </span>
                          {focusedSphere === sphere.id && (
                            <span className="text-xs text-cyan-300">
                              🎯 High LOD
                            </span>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSphereVisibility(sphere.id)
                            }}
                            className="p-1 rounded hover:bg-white/10 transition-colors duration-200"
                          >
                            {sphere.visible ? (
                              <Eye className="w-3 h-3 text-white/70" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-white/40" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              resetSpherePosition(sphere.id)
                            }}
                            className="p-1 rounded hover:bg-white/10 transition-colors duration-200"
                          >
                            <RotateCcw className="w-3 h-3 text-white/70" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-white/60 font-mono">
                        X: {sphere.x.toFixed(2)} Y: {sphere.y.toFixed(2)} Z:{' '}
                        {sphere.z.toFixed(2)}
                      </div>

                      {selectedSphere === sphere.id && (
                        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                          {(['x', 'y', 'z'] as const).map((axis) => (
                            <div
                              key={axis}
                              className="flex items-center space-x-2"
                            >
                              <label className="text-xs text-white/70 w-4 uppercase font-bold">
                                {axis}:
                              </label>
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
                                className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                              />
                              <span className="text-xs text-white/60 w-12 text-right font-mono">
                                {sphere[axis].toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LOD-Optimized 3D Model Container */}
      <div className="fixed top-0 left-0 w-full h-screen flex items-center justify-center z-5 pointer-events-none">
        <div className="relative w-full h-full px-4">
          <div className="relative w-full h-full flex items-center justify-center transition-all duration-700 ease-out">
            <Canvas
              style={{
                background: 'transparent',
                width: '100%',
                height: '100%',
              }}
            >
              <Suspense fallback={null}>
                {/* LOD-Optimized Camera Animation */}
                <LODStaticCameraAnimation
                  cameraTarget={cameraTarget}
                  modelScale={modelScale}
                  onAnimationComplete={handleAnimationComplete}
                  focusedSphere={focusedSphere}
                  spheres={spheres}
                  targetRotation={targetRotation}
                  cameraMode={cameraMode}
                />

                {/* Adaptive Lighting based on performance */}
                <ambientLight intensity={0.6 + (modelScale - 1.5) * 0.1} />
                <directionalLight
                  position={[15, 15, 8]}
                  intensity={1.4 + (modelScale - 1.5) * 0.2}
                  castShadow
                />
                <directionalLight
                  position={[-15, 8, -8]}
                  intensity={1.0 + (modelScale - 1.5) * 0.1}
                />
                <pointLight
                  position={[0, 12, 0]}
                  intensity={0.8 + (modelScale - 1.5) * 0.1}
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

                {/* LOD-Optimized 3D Model */}
                <group>
                  <LODTinyHouseModel
                    targetRotation={targetRotation}
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

            {/* Floating elements with LOD */}
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
      </div>

      {/* Scroll content */}
      <div className="relative z-10 pt-[100vh]">
        <div className="h-[200vh] bg-gradient-to-b from-transparent to-slate-900/50" />
      </div>
    </div>
  )
}
