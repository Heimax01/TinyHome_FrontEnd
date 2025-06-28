import React, { useState, useEffect, useRef, Suspense } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls, Environment } from '@react-three/drei'
import type { Group } from 'three'

// 3D Model Component with smooth interpolated rotation
function TinyHouseModel({
  targetRotation,
  scale,
}: {
  targetRotation: number
  scale: number
}) {
  const { scene } = useGLTF('/tiny_home/Tiny_House.glb')
  const meshRef = useRef<Group>(null)
  const currentRotation = useRef<number>(0)

  useFrame(() => {
    if (meshRef.current) {
      // Smooth interpolation for rotation (lerp)
      const lerpFactor = 0.1 // Adjust for smoothness (0.05 = very smooth, 0.2 = more responsive)
      currentRotation.current +=
        (targetRotation - currentRotation.current) * lerpFactor
      meshRef.current.rotation.y = currentRotation.current
    }
  })

  return (
    <group ref={meshRef} scale={[scale, scale, scale]} position={[0, -1.2, 0]}>
      <primitive object={scene} />
    </group>
  )
}

// Preload the model for better performance
useGLTF.preload('/tiny_home/Tiny_House.glb')

export default function MenuHome(): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false)
  const [notificationShown, setNotificationShown] = useState<boolean>(false)
  const [showNotification, setShowNotification] = useState<boolean>(false)
  const [targetRotation, setTargetRotation] = useState<number>(0)
  const [titleOpacity, setTitleOpacity] = useState<number>(1)
  const [modelScale, setModelScale] = useState<number>(1.5)

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

  useEffect(() => {
    let accumulatedRotation = 0
    let isScrolling = false
    let scrollTimeout: NodeJS.Timeout

    const handleWheel = (e: WheelEvent): void => {
      // Prevent default scrolling behavior
      e.preventDefault()

      // Improved rotation sensitivity for smoother control
      const rotationSensitivity = 0.005 // Reduced for finer control
      accumulatedRotation += e.deltaY * rotationSensitivity

      // Set target rotation for smooth interpolation
      setTargetRotation(accumulatedRotation)

      // Calculate rotation in degrees for progressive stages
      const rotationDegrees =
        Math.abs((accumulatedRotation * 180) / Math.PI) % 360

      // Smooth scrolling indicator
      isScrolling = true
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        isScrolling = false
      }, 150)

      // STAGE 1: Title Fade (0° - 30°)
      let newTitleOpacity: number
      if (rotationDegrees < 30) {
        newTitleOpacity = Math.max(1 - rotationDegrees / 30, 0)
      } else {
        newTitleOpacity = 0
      }
      setTitleOpacity(newTitleOpacity)

      // STAGE 2: Model Scaling (30° - 60°)
      let newModelScale: number
      if (rotationDegrees < 30) {
        // Stage 1: Normal size
        newModelScale = 1.5
      } else if (rotationDegrees < 60) {
        // Stage 2: Growing bigger (1.5 to 2.8 for better visibility in full width)
        const scaleProgress = (rotationDegrees - 30) / 30 // 0 to 1
        newModelScale = 1.5 + scaleProgress * 1.3 // 1.5 to 2.8
      } else {
        // Stage 3: Maximum size
        newModelScale = 2.8
      }
      setModelScale(newModelScale)

      // STAGE 3: Sidebar Appearance (60°+)
      if (rotationDegrees >= 60 && !sidebarOpen) {
        setSidebarOpen(true)

        // Show notification on first auto-open
        if (!notificationShown) {
          setShowNotification(true)
          setTimeout(() => {
            setShowNotification(false)
          }, 3000)
          setNotificationShown(true)
        }
      }
    }

    // Add wheel event listener with improved handling
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
        // Close all dropdowns when sidebar closes
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
    // Close all dropdowns when sidebar closes
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

  // Calculate rotation in degrees for display
  const rotationDegrees = Math.round(
    Math.abs((targetRotation * 180) / Math.PI) % 360
  )

  // Determine current stage for display
  const getCurrentStage = (): string => {
    if (rotationDegrees < 30) return 'Stage 1: Title Visible'
    if (rotationDegrees < 60) return 'Stage 2: Model Growing'
    return 'Stage 3: Navigation Active'
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Progress Indicator */}
      <div
        className={`fixed top-5 left-5 px-4 py-2 rounded-xl text-white text-sm z-50 transition-all duration-300 backdrop-blur-md border border-white/20 ${
          rotationDegrees >= 60
            ? 'bg-emerald-500/30 shadow-lg shadow-emerald-500/25'
            : rotationDegrees >= 30
            ? 'bg-orange-500/30 shadow-lg shadow-orange-500/25'
            : 'bg-white/10 shadow-lg shadow-black/25'
        }`}
      >
        <div className="flex flex-col items-center space-y-1">
          <span className="font-medium">{getCurrentStage()}</span>
          <span className="text-xs opacity-80">
            {rotationDegrees}° • Scale: {modelScale.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="fixed top-5 right-5 w-48 h-2 bg-white/10 rounded-full backdrop-blur-md z-50">
        <div
          className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-cyan-400 via-orange-400 to-emerald-400"
          style={{
            width: `${Math.min((rotationDegrees / 60) * 100, 100)}%`,
          }}
        />
        <div className="flex justify-between mt-1 text-xs text-white/60">
          <span>0°</span>
          <span>30°</span>
          <span>60°</span>
        </div>
      </div>

      {/* Persistent Hero Section with 3D Model - Full Width */}
      <div className="fixed top-0 left-0 w-full h-screen flex items-center justify-center z-5 pointer-events-none">
        <div className="relative w-full h-full px-4">
          {/* Hero Title - Progressive Fade */}
          <div
            className="absolute top-0 left-0 w-full text-center z-10"
            style={{
              opacity: titleOpacity,
              transform: `translateY(${(1 - titleOpacity) * -20}px)`,
              transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
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

            {/* Stage 1 Instructions */}
            <div className="mt-8">
              <p className="text-white/70 text-lg">
                Scroll to begin the experience
              </p>
              <p className="text-white/50 text-sm mt-2">
                Watch the title fade → model grow → navigation appear
              </p>
            </div>
          </div>

          {/* 3D Model Container - Full Width */}
          <div className="relative w-full h-full flex items-center justify-center transition-all duration-700 ease-out">
            {/* Three.js Canvas - Full Width and Height */}
            <Canvas
              camera={{
                position: [0, 3, 8 - (modelScale - 1.5) * 1.5],
                fov: 45 - (modelScale - 1.5) * 3,
              }}
              style={{
                background: 'transparent',
                width: '100%',
                height: '100%',
              }}
            >
              <Suspense fallback={null}>
                {/* Enhanced Lighting that adapts to model scale */}
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

                {/* Environment for better lighting */}
                <Environment preset="sunset" />

                {/* 3D Model - Smooth Rotation with Dynamic Scaling */}
                <TinyHouseModel
                  targetRotation={targetRotation}
                  scale={modelScale}
                />

                {/* Controls (disabled for wheel-based rotation) */}
                <OrbitControls
                  enabled={false}
                  enableZoom={false}
                  enablePan={false}
                  enableRotate={false}
                />
              </Suspense>
            </Canvas>

            {/* Floating elements around the 3D model - Full width positioning */}
            <div
              className="absolute top-16 right-16 bg-cyan-400/40 rounded-full animate-pulse transition-all duration-500"
              style={{
                width: `${14 + (modelScale - 1.5) * 6}px`,
                height: `${14 + (modelScale - 1.5) * 6}px`,
              }}
            ></div>
            <div
              className="absolute bottom-16 left-16 bg-purple-400/40 rounded-full animate-ping transition-all duration-500"
              style={{
                width: `${12 + (modelScale - 1.5) * 5}px`,
                height: `${12 + (modelScale - 1.5) * 5}px`,
                animationDelay: '1s',
              }}
            ></div>
            <div
              className="absolute top-1/3 left-16 bg-pink-400/40 rounded-full animate-pulse transition-all duration-500"
              style={{
                width: `${10 + (modelScale - 1.5) * 4}px`,
                height: `${10 + (modelScale - 1.5) * 4}px`,
                animationDelay: '2s',
              }}
            ></div>
            <div
              className="absolute bottom-1/3 right-20 bg-emerald-400/40 rounded-full animate-pulse transition-all duration-500"
              style={{
                width: `${10 + (modelScale - 1.5) * 4}px`,
                height: `${10 + (modelScale - 1.5) * 4}px`,
                animationDelay: '3s',
              }}
            ></div>
            <div
              className="absolute top-1/4 right-1/4 bg-yellow-400/30 rounded-full animate-pulse transition-all duration-500"
              style={{
                width: `${8 + (modelScale - 1.5) * 3}px`,
                height: `${8 + (modelScale - 1.5) * 3}px`,
                animationDelay: '4s',
              }}
            ></div>
            <div
              className="absolute bottom-1/4 left-1/4 bg-indigo-400/30 rounded-full animate-pulse transition-all duration-500"
              style={{
                width: `${8 + (modelScale - 1.5) * 3}px`,
                height: `${8 + (modelScale - 1.5) * 3}px`,
                animationDelay: '5s',
              }}
            ></div>
          </div>

          {/* Stage-based Instructions - Bottom positioned */}
          <div className="absolute bottom-16 left-0 w-full text-center z-10">
            {rotationDegrees < 30 && (
              <div className="transition-opacity duration-500">
                <p className="text-white/70 text-lg">
                  Continue scrolling to see the model grow
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 1 of 3: Title will fade away
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
                  Full-width navigation active! Smooth rotation enabled
                </p>
                <p className="text-white/50 text-sm mt-2">
                  Stage 3 of 3: Complete experience unlocked
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glassmorphism Sidebar with Dropdown Menus */}
      <div
        className={`fixed top-0 right-0 h-full w-96 z-20 transition-all duration-700 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } bg-white/10 backdrop-blur-xl border-l border-white/20 shadow-2xl shadow-purple-500/20 overflow-y-auto`}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeSidebar}
          className="absolute top-5 right-5 p-3 text-white/90 hover:text-white hover:bg-white/20 rounded-full transition-all duration-300 hover:rotate-90 backdrop-blur-sm border border-white/20 hover:border-white/40 shadow-lg hover:shadow-cyan-500/25 z-10"
        >
          <X size={20} />
        </button>

        {/* Notification */}
        <div
          className={`absolute top-20 left-1/2 transform -translate-x-1/2 bg-white/20 backdrop-blur-md text-white px-5 py-3 rounded-2xl text-sm text-center transition-all duration-500 border border-white/30 shadow-lg shadow-emerald-500/25 z-10 ${
            showNotification
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span>Full-Width Experience • Smooth Rotation Active</span>
          </div>
        </div>

        {/* Navigation Menu with Dropdowns */}
        <nav className="mt-36 text-center relative z-10 px-4">
          <ul className="space-y-4">
            {Object.keys(menuData).map((item, index) => (
              <li
                key={item}
                className={`transition-all duration-700 ease-in-out ${
                  sidebarOpen
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 -translate-y-5'
                }`}
                style={{
                  transitionDelay: sidebarOpen
                    ? `${(index + 1) * 150}ms`
                    : '0ms',
                }}
              >
                {/* Main Menu Button */}
                <button
                  onClick={() => toggleDropdown(item)}
                  className="group relative w-full py-4 px-6 text-white/90 text-lg font-medium uppercase tracking-wider hover:text-white transition-all duration-300 rounded-xl hover:bg-white/10 backdrop-blur-sm border border-transparent hover:border-white/20 hover:shadow-lg hover:shadow-cyan-500/20 flex items-center justify-between"
                >
                  <span className="relative z-10">
                    {item.replace('_', ' ')}
                  </span>

                  {/* Dropdown Icon */}
                  <div
                    className={`transition-transform duration-300 ${
                      dropdownStates[item as keyof typeof dropdownStates]
                        ? 'rotate-180'
                        : 'rotate-0'
                    }`}
                  >
                    {dropdownStates[item as keyof typeof dropdownStates] ? (
                      <ChevronUp size={18} className="text-cyan-400" />
                    ) : (
                      <ChevronDown size={18} className="text-white/70" />
                    )}
                  </div>

                  {/* Animated background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Animated underline */}
                  <span className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-cyan-400 to-purple-400 group-hover:w-16 transition-all duration-500"></span>

                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 blur-xl" />
                </button>

                {/* Dropdown Menu */}
                <div
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    dropdownStates[item as keyof typeof dropdownStates]
                      ? 'max-h-96 opacity-100'
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="mt-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg shadow-xl">
                    <ul className="py-2">
                      {menuData[item as keyof typeof menuData].map(
                        (subItem, subIndex) => (
                          <li
                            key={subItem}
                            className={`transition-all duration-300 ease-in-out ${
                              dropdownStates[
                                item as keyof typeof dropdownStates
                              ]
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-2'
                            }`}
                            style={{
                              transitionDelay: dropdownStates[
                                item as keyof typeof dropdownStates
                              ]
                                ? `${subIndex * 100}ms`
                                : '0ms',
                            }}
                          >
                            <a
                              href={`#${subItem
                                .toLowerCase()
                                .replace(/\s+/g, '-')}`}
                              className="group block py-3 px-6 text-white/80 text-sm font-normal hover:text-white hover:bg-white/10 transition-all duration-200 relative overflow-hidden"
                            >
                              <span className="relative z-10 flex items-center space-x-3">
                                <div className="w-1.5 h-1.5 bg-cyan-400/60 rounded-full group-hover:bg-cyan-400 transition-colors duration-200"></div>
                                <span>{subItem}</span>
                              </span>

                              {/* Hover background */}
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                              {/* Left border accent */}
                              <div className="absolute left-0 top-0 h-full w-0 bg-gradient-to-b from-cyan-400 to-purple-400 group-hover:w-1 transition-all duration-300"></div>
                            </a>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </nav>

        {/* Decorative Elements */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full opacity-50" />

        {/* Floating particles effect */}
        <div className="absolute top-1/4 left-8 w-2 h-2 bg-cyan-400/30 rounded-full animate-pulse" />
        <div
          className="absolute top-1/3 right-12 w-1 h-1 bg-purple-400/40 rounded-full animate-ping"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute bottom-1/3 left-12 w-1.5 h-1.5 bg-pink-400/30 rounded-full animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Enhanced Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-10 lg:hidden transition-all duration-300"
          onClick={closeSidebar}
        />
      )}
    </div>
  )
}
