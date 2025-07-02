import React, { useState, useEffect, useRef, Suspense } from 'react'
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
import type { Group } from 'three'

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

// Individual Positioning Sphere Component - Relative to House
function PositioningSphere({
  position,
  color,
  visible,
}: {
  position: [number, number, number]
  color: string
  visible: boolean
}) {
  const meshRef = useRef<Group>(null)

  useFrame((state) => {
    if (meshRef.current && visible) {
      // Gentle floating animation - position is relative to house
      meshRef.current.position.set(
        position[0],
        position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05,
        position[2]
      )
    }
  })

  if (!visible) return null

  return (
    <group ref={meshRef}>
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.9}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

// Camera Animation Component
function AnimatedCamera({
  cameraTarget,
  modelScale,
  onAnimationComplete,
}: {
  cameraTarget: {
    position: [number, number, number]
    lookAt: [number, number, number]
    animating: boolean
  }
  modelScale: number
  onAnimationComplete: () => void
}) {
  const { camera } = useThree()
  const currentPosition = useRef<[number, number, number]>([0, 3, 8])
  const currentLookAt = useRef<[number, number, number]>([0, 0, 0])
  const isAnimating = useRef<boolean>(false)

  useFrame(() => {
    if (cameraTarget.animating && !isAnimating.current) {
      // Start animation - get current camera position
      currentPosition.current = [
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ]
      currentLookAt.current = [0, 0, 0] // Current lookAt target
      isAnimating.current = true
    }

    if (cameraTarget.animating || isAnimating.current) {
      // Smooth interpolation for camera position - shortest path
      const lerpFactor = 0.08 // Smooth animation speed

      // Interpolate position (shortest path)
      currentPosition.current[0] +=
        (cameraTarget.position[0] - currentPosition.current[0]) * lerpFactor
      currentPosition.current[1] +=
        (cameraTarget.position[1] - currentPosition.current[1]) * lerpFactor
      currentPosition.current[2] +=
        (cameraTarget.position[2] - currentPosition.current[2]) * lerpFactor

      // Interpolate lookAt
      currentLookAt.current[0] +=
        (cameraTarget.lookAt[0] - currentLookAt.current[0]) * lerpFactor
      currentLookAt.current[1] +=
        (cameraTarget.lookAt[1] - currentLookAt.current[1]) * lerpFactor
      currentLookAt.current[2] +=
        (cameraTarget.lookAt[2] - currentLookAt.current[2]) * lerpFactor

      // Apply to camera
      camera.position.set(...currentPosition.current)
      camera.lookAt(...currentLookAt.current)

      // Check if animation is complete (shortest distance threshold)
      const positionDistance = Math.sqrt(
        Math.pow(cameraTarget.position[0] - currentPosition.current[0], 2) +
          Math.pow(cameraTarget.position[1] - currentPosition.current[1], 2) +
          Math.pow(cameraTarget.position[2] - currentPosition.current[2], 2)
      )

      if (positionDistance < 0.1) {
        isAnimating.current = false
        onAnimationComplete()
      }
    } else {
      // Default camera behavior when not animating
      const defaultPosition: [number, number, number] = [
        0,
        3,
        8 - (modelScale - 1.5) * 1.5,
      ]

      // Only apply default if not currently animating to a sphere
      if (!isAnimating.current) {
        currentPosition.current[0] +=
          (defaultPosition[0] - currentPosition.current[0]) * 0.02
        currentPosition.current[1] +=
          (defaultPosition[1] - currentPosition.current[1]) * 0.02
        currentPosition.current[2] +=
          (defaultPosition[2] - currentPosition.current[2]) * 0.02

        currentLookAt.current[0] += (0 - currentLookAt.current[0]) * 0.02
        currentLookAt.current[1] += (0 - currentLookAt.current[1]) * 0.02
        currentLookAt.current[2] += (0 - currentLookAt.current[2]) * 0.02

        camera.position.set(...currentPosition.current)
        camera.lookAt(...currentLookAt.current)
      }
    }
  })

  return null
}

// 3D Model Component with spheres that rotate together
function TinyHouseModel({
  targetRotation,
  scale,
  spheres = [],
}: {
  targetRotation: number
  scale: number
  spheres?: SpherePosition[]
}) {
  const { scene } = useGLTF('/tiny_home/Tiny_House.glb')
  const meshRef = useRef<Group>(null)
  const currentRotation = useRef<number>(0)
  const velocity = useRef<number>(0)

  useFrame(() => {
    if (meshRef.current) {
      // Ultra-smooth interpolation with momentum
      const lerpFactor = 0.08 // Slightly slower for ultra-smooth feel
      const difference = targetRotation - currentRotation.current

      // Add momentum/inertia for natural feel
      velocity.current += difference * 0.02
      velocity.current *= 0.85 // Damping

      // Apply both direct interpolation and momentum
      currentRotation.current +=
        difference * lerpFactor + velocity.current * 0.1

      meshRef.current.rotation.y = currentRotation.current
    }
  })

  return (
    <group ref={meshRef} scale={[scale, scale, scale]} position={[0, -1.2, 0]}>
      {/* House Model */}
      <primitive object={scene} />

      {/* Spheres positioned relative to house - rotate together */}
      {spheres &&
        spheres.length > 0 &&
        spheres.map((sphere) => (
          <PositioningSphere
            key={sphere.id}
            position={[sphere.x, sphere.y, sphere.z]}
            color={sphere.color}
            visible={sphere.visible}
          />
        ))}
    </group>
  )
}

// Preload the model for better performance
useGLTF.preload('/tiny_home/Tiny_House.glb')

export default function SpherePositioningSystem(): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [notificationShown, setNotificationShown] = useState<boolean>(false)
  const [showNotification, setShowNotification] = useState<boolean>(false)
  const [targetRotation, setTargetRotation] = useState<number>(0)
  const [titleOpacity, setTitleOpacity] = useState<number>(1)
  const [modelScale, setModelScale] = useState<number>(1.5)
  const [rotationDegrees, setRotationDegrees] = useState<number>(0)
  const [showSphereControls, setShowSphereControls] = useState<boolean>(false)
  const [selectedSphere, setSelectedSphere] = useState<number | null>(null)

  // Camera animation states
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

  // Dropdown menu data
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

  // Initialize 16 positioning spheres with specific appliance coordinates
  const [spheres, setSpheres] = useState<SpherePosition[]>(() => {
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

    // Flatten all appliances from menu data in order
    const allAppliances = [
      ...menuData.Living_Room,
      ...menuData.Kitchen,
      ...menuData.Bedroom,
      ...menuData.Bathroom,
    ]

    // Specific coordinates for each appliance
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

    return Array.from({ length: 16 }, (_, i) => ({
      id: i + 1,
      x: specificCoordinates[i]?.x || 0,
      y: specificCoordinates[i]?.y || 0,
      z: specificCoordinates[i]?.z || 0,
      visible: true,
      color: colors[i],
      name: allAppliances[i] || `Point ${i + 1}`,
    }))
  })

  // Dropdown states for each menu item
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

  useEffect(() => {
    let accumulatedDegrees = 0
    let isScrolling = false
    let scrollTimeout: NodeJS.Timeout

    const handleWheel = (e: WheelEvent): void => {
      // Prevent default scrolling behavior
      e.preventDefault()

      // Ultra-precise degree-based rotation
      const degreesPerScroll = 1.2
      const scrollDirection = e.deltaY > 0 ? 1 : -1

      // Accumulate degrees for precise control
      accumulatedDegrees += scrollDirection * degreesPerScroll

      // Convert degrees to radians for Three.js
      const targetRadians = (accumulatedDegrees * Math.PI) / 180
      setTargetRotation(targetRadians)

      // Update degree display (always positive, 0-360)
      const displayDegrees = Math.abs(accumulatedDegrees) % 360
      setRotationDegrees(displayDegrees)

      // Smooth scrolling indicator
      isScrolling = true
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        isScrolling = false
      }, 200)

      // STAGE 1: Title Fade (0° - 30°)
      let newTitleOpacity: number
      if (displayDegrees < 30) {
        newTitleOpacity = Math.max(1 - displayDegrees / 30, 0)
      } else {
        newTitleOpacity = 0
      }
      setTitleOpacity(newTitleOpacity)

      // STAGE 2: Model Scaling (30° - 60°)
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

      // STAGE 3: Sidebar Appearance (60°+)
      if (displayDegrees >= 60 && !sidebarOpen) {
        setSidebarOpen(true)
        setShowSphereControls(true) // Show sphere controls when sidebar appears

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

  // Handle ESC key to close sidebar
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

  // Camera animation functions
  const zoomToSphere = (sphereId: number): void => {
    const sphere = spheres.find((s) => s.id === sphereId)
    if (!sphere) return

    console.log(`Zooming to sphere ${sphereId}: ${sphere.name}`, sphere) // Debug log

    // Calculate sphere position in world space (accounting for house rotation)
    const distance = 1.5 // Closer distance for better view
    const height = 0.8 // Height above sphere

    // Apply house rotation to sphere position to get world coordinates
    const worldX =
      sphere.x * Math.cos(targetRotation) - sphere.z * Math.sin(targetRotation)
    const worldZ =
      sphere.x * Math.sin(targetRotation) + sphere.z * Math.cos(targetRotation)
    const worldY = sphere.y

    // Calculate camera position - shortest path approach
    const angle = Math.atan2(worldZ, worldX) + Math.PI / 3 // Offset for good viewing angle
    const cameraX = worldX + distance * Math.cos(angle)
    const cameraY = worldY + height
    const cameraZ = worldZ + distance * Math.sin(angle)

    console.log('Camera target:', {
      position: [cameraX, cameraY, cameraZ],
      lookAt: [worldX, worldY, worldZ],
    }) // Debug log

    setCameraTarget({
      position: [cameraX, cameraY, cameraZ],
      lookAt: [worldX, worldY, worldZ],
      animating: true,
    })

    setNotificationText(`Zooming to ${sphere.name}`)
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  const resetCamera = (): void => {
    console.log('Resetting camera to overview') // Debug log

    setCameraTarget({
      position: [0, 3, 8 - (modelScale - 1.5) * 1.5],
      lookAt: [0, 0, 0],
      animating: true,
    })

    setNotificationText('Returning to overview')
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  const handleAnimationComplete = (): void => {
    console.log('Animation complete') // Debug log
    setCameraTarget((prev) => ({ ...prev, animating: false }))
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
              x: (Math.random() - 0.5) * 12, // -6 to +6 range
              y: Math.random() * 6 - 1, // -1 to +5 range
              z: (Math.random() - 0.5) * 12, // -6 to +6 range
            }
          : sphere
      )
    )
  }

  const resetAllSpheres = (): void => {
    setSpheres((prev) =>
      prev.map((sphere) => ({
        ...sphere,
        x: (Math.random() - 0.5) * 12, // -6 to +6 range
        y: Math.random() * 6 - 1, // -1 to +5 range
        z: (Math.random() - 0.5) * 12, // -6 to +6 range
        visible: true,
      }))
    )
    setSelectedSphere(null)
  }

  // Export coordinates function
  const exportCoordinates = (): void => {
    const coordinates = spheres.map((sphere) => ({
      id: sphere.id,
      name: sphere.name,
      position: {
        x: sphere.x.toFixed(2),
        y: sphere.y.toFixed(2),
        z: sphere.z.toFixed(2),
      },
      visible: sphere.visible,
      color: sphere.color,
    }))

    console.log('Sphere Coordinates:', JSON.stringify(coordinates, null, 2))

    // Show notification
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  // Determine current stage for display
  const getCurrentStage = (): string => {
    if (rotationDegrees < 30) return 'Stage 1: Title Visible'
    if (rotationDegrees < 60) return 'Stage 2: Model Growing'
    return 'Stage 3: Navigation + Spheres Active'
  }

  const getRotationDirection = (): string => {
    const totalRotations = Math.floor(
      Math.abs((targetRotation * 180) / Math.PI) / 360
    )
    if (totalRotations === 0) return ''
    return ` (${totalRotations} full rotation${totalRotations > 1 ? 's' : ''})`
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Enhanced Progress Indicator */}
      <div
        className={`fixed top-5 left-5 px-5 py-3 rounded-xl text-white text-sm z-50 transition-all duration-300 backdrop-blur-md border border-white/20 ${
          rotationDegrees >= 60
            ? 'bg-emerald-500/30 shadow-lg shadow-emerald-500/25'
            : rotationDegrees >= 30
            ? 'bg-orange-500/30 shadow-lg shadow-orange-500/25'
            : 'bg-white/10 shadow-lg shadow-black/25'
        }`}
      >
        <div className="flex flex-col items-center space-y-1">
          <span className="font-medium">{getCurrentStage()}</span>
          <span className="text-xs opacity-90 font-mono">
            {rotationDegrees.toFixed(1)}° • Scale: {modelScale.toFixed(1)}x
          </span>
          <span className="text-xs opacity-70">
            Ultra-Smooth Mode{getRotationDirection()}
          </span>
          {showSphereControls && (
            <span className="text-xs opacity-80 text-cyan-300">
              • 16 Positioning Spheres Active
            </span>
          )}
        </div>
      </div>

      {/* Sphere Controls Toggle */}
      {showSphereControls && (
        <div className="fixed top-5 left-80 z-50">
          <button
            onClick={() => setShowSphereControls(!showSphereControls)}
            className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white text-sm hover:bg-white/20 transition-all duration-200 flex items-center space-x-2"
          >
            <Move className="w-4 h-4" />
            <span>Sphere Controls</span>
          </button>
        </div>
      )}

      {/* Precise Degree Progress Bar */}
      <div className="fixed top-5 right-5 w-56 h-3 bg-white/10 rounded-full backdrop-blur-md z-50 border border-white/20">
        <div
          className="h-full rounded-full transition-all duration-200 bg-gradient-to-r from-cyan-400 via-orange-400 to-emerald-400 relative overflow-hidden"
          style={{
            width: `${Math.min((rotationDegrees / 60) * 100, 100)}%`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-white/60 font-mono">
          <span>0°</span>
          <span>30°</span>
          <span>60°</span>
        </div>
        <div
          className="absolute top-0 w-0.5 h-3 bg-white/80 rounded-full transition-all duration-200"
          style={{
            left: `${Math.min((rotationDegrees / 60) * 100, 100)}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Rotation Control Instructions */}
      <div className="fixed bottom-5 left-5 px-4 py-2 rounded-xl text-white text-xs z-50 backdrop-blur-md border border-white/20 bg-white/10">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
          <span>1.2° per scroll • Ultra-smooth interpolation</span>
          {showSphereControls && (
            <>
              <span className="text-white/50">•</span>
              <span className="text-cyan-300">
                16 positioning spheres active
              </span>
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

      {/* Persistent Hero Section with 3D Model - Full Width */}
      <div className="fixed top-0 left-0 w-full h-screen flex items-center justify-center z-5 pointer-events-none">
        <div className="relative w-full h-full px-4">
          {/* Hero Title - Progressive Fade */}
          <div
            className="absolute top-0 left-0 w-full text-center z-10"
            style={{
              opacity: titleOpacity,
              transform: `translateY(${(1 - titleOpacity) * -20}px)`,
              transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
              paddingTop: '8rem',
            }}
          >
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
              Tiny Homes
            </h1>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-light text-white/90 tracking-wide mt-3">
              Custom made
            </h2>
            <div className="mt-6 w-32 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 mx-auto rounded-full"></div>

            <div className="mt-8">
              <p className="text-white/70 text-lg">
                Scroll to begin the ultra-smooth experience
              </p>
              <p className="text-white/50 text-sm mt-2">
                Precise 1.2° rotation control • Professional smoothness
              </p>
            </div>
          </div>

          {/* 3D Model Container - Full Width */}
          <div className="relative w-full h-full flex items-center justify-center transition-all duration-700 ease-out">
            {/* Three.js Canvas - Full Width and Height */}
            <Canvas
              style={{
                background: 'transparent',
                width: '100%',
                height: '100%',
              }}
            >
              <Suspense fallback={null}>
                {/* Animated Camera System */}
                <AnimatedCamera
                  cameraTarget={cameraTarget}
                  modelScale={modelScale}
                  onAnimationComplete={handleAnimationComplete}
                />

                {/* Enhanced Lighting */}
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

                {/* 3D Model with Spheres - Both rotate together */}
                <group>
                  <TinyHouseModel
                    targetRotation={targetRotation}
                    scale={modelScale}
                    spheres={showSphereControls ? spheres : []}
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

            {/* Enhanced Floating elements */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`absolute bg-gradient-to-r from-cyan-400/40 to-purple-400/40 rounded-full animate-pulse transition-all duration-500`}
                style={{
                  width: `${
                    14 +
                    (modelScale - 1.5) * 6 +
                    Math.sin(rotationDegrees * 0.1 + i) * 2
                  }px`,
                  height: `${
                    14 +
                    (modelScale - 1.5) * 6 +
                    Math.sin(rotationDegrees * 0.1 + i) * 2
                  }px`,
                  top: `${20 + i * 15}%`,
                  left: i % 2 === 0 ? '5%' : '90%',
                  animationDelay: `${i * 0.5}s`,
                }}
              />
            ))}
          </div>

          {/* Stage-based Instructions */}
          <div className="absolute bottom-16 left-0 w-full text-center z-10">
            {rotationDegrees < 30 && (
              <div className="transition-opacity duration-500">
                <p className="text-white/70 text-lg">
                  Continue scrolling to see the model grow
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 1 of 3: Title visible • Model at normal size
                </p>
              </div>
            )}
            {rotationDegrees >= 30 && rotationDegrees < 60 && (
              <div className="transition-opacity duration-500">
                <p className="text-white/70 text-lg">
                  Model is growing bigger! Keep scrolling
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 2 of 3: Model scaling up in full width
                </p>
              </div>
            )}
            {rotationDegrees >= 60 && (
              <div className="transition-opacity duration-500">
                <p className="text-white/70 text-lg">
                  Full-width navigation + positioning spheres active!
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 3 of 3: Complete experience unlocked • 16 spheres ready
                  for positioning
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glassmorphism Sidebar with Navigation + Sphere Controls */}
      <div
        className={`fixed top-0 right-0 h-full w-96 z-20 transform transition-transform duration-700 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } bg-white/10 backdrop-blur-xl border-l border-white/20 shadow-2xl shadow-purple-500/20`}
      >
        <div className="relative h-full overflow-y-auto">
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none" />

          {/* Close button */}
          <button
            onClick={closeSidebar}
            className="absolute top-6 right-6 z-30 p-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-all duration-200 hover:rotate-90"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Sidebar content */}
          <div className="relative z-10 p-8 pt-20">
            {/* Navigation Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-6">
                Navigation
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
                          // Find the sphere ID for this appliance
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
                                ) // Debug log
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
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* Sphere Controls Section */}
            {showSphereControls && (
              <div className="border-t border-white/20 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Positioning Spheres
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
                      className="px-3 py-1 bg-orange-500/20 border border-orange-400/50 rounded-lg text-orange-300 text-xs hover:bg-orange-500/30 transition-all duration-200 flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset All</span>
                    </button>
                  </div>
                </div>

                {/* Camera Controls */}
                <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-white/90 text-sm font-medium">
                      Camera View
                    </span>
                    <button
                      onClick={resetCamera}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white/80 transition-colors duration-200"
                    >
                      Reset View
                    </button>
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Click any appliance below to zoom to its location
                  </p>
                </div>

                {/* Sphere List */}
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
                        ) // Debug log
                        if (selectedSphere === sphere.id) {
                          setSelectedSphere(null)
                          resetCamera() // Reset camera when deselecting
                        } else {
                          setSelectedSphere(sphere.id)
                          zoomToSphere(sphere.id) // Zoom to sphere when clicked
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

                      {/* Position Controls (shown when selected) */}
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
                              <span className="text-xs text-white/60 font-mono w-12 text-right">
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

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-10 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(45deg, #00ffff, #ff00ff);
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: linear-gradient(45deg, #00ffff, #ff00ff);
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  )
}
