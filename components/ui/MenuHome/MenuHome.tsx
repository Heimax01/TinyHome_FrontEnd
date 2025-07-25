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
import type { Group } from 'three'
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

// Ultra-Smooth OrbitControls Component (RENAMED to avoid conflict)
function SmoothCameraControls() {
  const { camera, gl } = useThree()
  const controlsRef = useRef<any>(null)

  // Ultra-smooth zoom state
  const targetZoom = useRef<number>(1)
  const currentZoom = useRef<number>(1)
  const zoomVelocity = useRef<number>(0)
  const isZooming = useRef<boolean>(false)

  // Smooth zoom parameters
  const ZOOM_DAMPING = 0.08 // Ultra-smooth damping factor
  const ZOOM_SENSITIVITY = 0.002 // Very fine zoom sensitivity
  const ZOOM_FRICTION = 0.92 // Smooth deceleration
  const MIN_ZOOM_VELOCITY = 0.001 // Minimum velocity threshold

  useEffect(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current

      // Custom wheel event handler for ultra-smooth zoom
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()

        // Calculate zoom delta with ultra-fine sensitivity
        const delta = event.deltaY * ZOOM_SENSITIVITY

        // Apply zoom delta to target
        targetZoom.current = Math.max(
          0.1,
          Math.min(50, targetZoom.current + delta)
        )

        // Start zooming animation
        isZooming.current = true

        // Add velocity for momentum
        zoomVelocity.current += delta * 0.1

        console.log(`Ultra-Smooth Zoom:`)
        console.log(`Delta: ${delta.toFixed(4)}`)
        console.log(`Target Zoom: ${targetZoom.current.toFixed(3)}`)
        console.log(`Current Zoom: ${currentZoom.current.toFixed(3)}`)
      }

      // Add custom wheel listener to canvas
      const canvas = gl.domElement
      canvas.addEventListener('wheel', handleWheel, { passive: false })

      // Disable default OrbitControls zoom
      controls.enableZoom = false

      return () => {
        canvas.removeEventListener('wheel', handleWheel)
      }
    }
  }, [gl])

  // Ultra-smooth zoom animation
  useFrame(() => {
    if (controlsRef.current && isZooming.current) {
      // Smooth interpolation towards target zoom
      const zoomDiff = targetZoom.current - currentZoom.current
      currentZoom.current += zoomDiff * ZOOM_DAMPING

      // Apply friction to velocity
      zoomVelocity.current *= ZOOM_FRICTION

      // Stop zooming when close enough and velocity is low
      if (
        Math.abs(zoomDiff) < 0.01 &&
        Math.abs(zoomVelocity.current) < MIN_ZOOM_VELOCITY
      ) {
        isZooming.current = false
        currentZoom.current = targetZoom.current
      }

      // Calculate camera distance based on zoom
      const baseDistance = 6 // Base distance from target
      const newDistance = baseDistance / currentZoom.current

      // Get current camera direction
      const direction = new ThreeVector3()
      camera.getWorldDirection(direction)
      direction.negate() // Reverse direction to point towards camera

      // Calculate new camera position
      const target = controlsRef.current.target
      const newPosition = target
        .clone()
        .add(direction.multiplyScalar(newDistance))

      // Smoothly move camera to new position
      camera.position.lerp(newPosition, ZOOM_DAMPING)

      // Update controls
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableZoom={false} // Disabled - using custom ultra-smooth zoom
      enablePan={true}
      enableRotate={true}
      dampingFactor={0.03} // Ultra-smooth damping for rotation and pan
      enableDamping={true}
      maxDistance={50}
      minDistance={0.1}
      maxPolarAngle={Math.PI}
      minPolarAngle={0}
      screenSpacePanning={true}
      rotateSpeed={0.8} // Slightly slower for smoothness
      panSpeed={0.6} // Slightly slower for smoothness
      autoRotate={false}
      autoRotateSpeed={0}
    />
  )
}

// LOD-Optimized 3D Model Component
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

  return (
    <group ref={meshRef} scale={[scale, scale, scale]} position={[0, -5, 10]}>
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

// Main Component (RENAMED to avoid conflict)
export default function TinyHomesUltraSmooth() {
  // Simplified state management - no scroll logic
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true) // Always open by default
  const [selectedSphere, setSelectedSphere] = useState<number | null>(null)
  const [focusedSphere, setFocusedSphere] = useState<number | null>(null)

  const [notificationText, setNotificationText] = useState<string>('')
  const [showNotification, setShowNotification] = useState<boolean>(false)

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

  // Fixed model scale - no scroll dependency
  const modelScale = 3.0

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
    setSelectedSphere(null)
    setDropdownStates({
      Living_Room: false,
      Kitchen: false,
      Bedroom: false,
      Bathroom: false,
    })
  }

  const openSidebar = (): void => {
    setSidebarOpen(true)
  }

  const toggleDropdown = (item: string): void => {
    setDropdownStates((prev) => ({
      ...prev,
      [item]: !prev[item as keyof typeof prev],
    }))
  }

  const selectSphere = (sphereId: number): void => {
    setSelectedSphere(sphereId)
    setFocusedSphere(sphereId)
    const sphere = spheres.find((s) => s.id === sphereId)
    if (sphere) {
      setNotificationText(
        `Selected ${sphere.name} - Use ultra-smooth OrbitControls to navigate`
      )
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
    }
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
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Status indicator */}
      <div className="fixed top-6 left-6 z-30 px-4 py-2 bg-black/30 backdrop-blur-md border border-white/20 rounded-xl text-white text-sm">
        <div className="flex items-center space-x-3">
          <span className="text-cyan-300 font-mono">
            Ultra-Smooth Navigation
          </span>
          <span className="text-white/50">•</span>
          <span className="text-emerald-300">Custom Zoom Engine</span>
          <span className="text-white/50">•</span>
          <span className="text-purple-300">Buttery Smooth Scroll</span>
        </div>
      </div>

      {/* Sidebar toggle button when closed */}
      {!sidebarOpen && (
        <button
          onClick={openSidebar}
          className="fixed top-6 right-6 z-30 p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all duration-200"
        >
          <Move className="w-5 h-5" />
        </button>
      )}

      {/* Notification */}
      {showNotification && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 px-6 py-3 bg-emerald-500/90 backdrop-blur-md border border-emerald-400/50 rounded-xl text-white text-sm shadow-xl shadow-emerald-500/25">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>{notificationText}</span>
          </div>
        </div>
      )}

      {/* Main 3D Scene */}
      <div className="fixed top-0 left-0 w-full h-screen">
        <div className="relative w-full h-full">
          {/* Title */}
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 text-center z-10 pointer-events-none">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3 leading-tight">
              Tiny Homes
            </h1>
            <p className="text-white/70 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Ultra-Smooth Navigation Experience
            </p>
            <p className="text-white/50 text-xs mt-1">
              Left-click + drag to rotate • Right-click + drag to pan • Scroll
              for ultra-smooth zoom
            </p>
          </div>

          {/* 3D Canvas */}
          <Canvas
            camera={{
              position: [0, 2.5, 50],
              fov: 45,
            }}
            style={{
              background: 'transparent',
              width: '100%',
              height: '100%',
            }}
          >
            <Suspense fallback={null}>
              {/* Ultra-Smooth Camera Controls (RENAMED component) */}
              <SmoothCameraControls />

              {/* Adaptive Lighting */}
              <ambientLight intensity={0.6} />
              <directionalLight
                position={[15, 15, 8]}
                intensity={1.4}
                castShadow
              />
              <directionalLight position={[-15, 8, -8]} intensity={1.0} />
              <pointLight position={[0, 12, 0]} intensity={0.8} />
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

              {/* 3D Model with Spheres */}
              <group>
                <LODTinyHouseModel
                  scale={modelScale}
                  spheres={spheres}
                  focusedSphere={focusedSphere}
                />
              </group>
            </Suspense>
          </Canvas>

          {/* Floating elements */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-cyan-400/30 rounded-full animate-pulse pointer-events-none"
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

      {/* Sidebar with glassmorphism */}
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
              Ultra-Smooth Navigation
            </h2>
            <button
              onClick={closeSidebar}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {/* Ultra-Smooth Controls Information */}
          <div className="mb-6 p-3 bg-white/[0.04] rounded-xl border border-white/10">
            <h3 className="text-sm font-medium text-white/90 mb-2">
              Ultra-Smooth Engine:
            </h3>
            <div className="text-xs text-white/70 space-y-1">
              <div>
                • <strong>Rotate:</strong> Left-click + drag (0.8x speed)
              </div>
              <div>
                • <strong>Pan:</strong> Right-click + drag (0.6x speed)
              </div>
              <div>
                • <strong>Zoom:</strong> Custom ultra-smooth scroll
              </div>
              <div>
                • <strong>Damping:</strong> 0.03 factor for silk-smooth motion
              </div>
              <div>
                • <strong>Sensitivity:</strong> 0.002 for precise control
              </div>
            </div>
            <div className="mt-2 text-xs text-emerald-300">
              🚀 Buttery smooth 60fps navigation experience
            </div>
          </div>

          {/* Navigation Menu */}
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
                            if (sphereId > 0) {
                              selectSphere(sphereId)
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

          {/* Sphere Controls */}
          <div className="border-t border-white/20 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Sphere Controls
              </h3>
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

            <div className="text-xs text-white/60 mb-4">
              Click appliances to select • Use ultra-smooth scroll to navigate
              to spheres
            </div>

            {/* Sphere List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
                      setFocusedSphere(null)
                    } else {
                      selectSphere(sphere.id)
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
                        Position: ({sphere.x.toFixed(2)}, {sphere.y.toFixed(2)},{' '}
                        {sphere.z.toFixed(2)})
                      </div>
                      <div className="text-xs text-cyan-300">
                        Use ultra-smooth scroll to navigate to this sphere
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
        </div>
      </div>
    </div>
  )
}
