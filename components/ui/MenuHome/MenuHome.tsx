import { useState, useEffect, useRef, Suspense } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'

// 3D Model Component
function TinyHouseModel({ rotation }: { rotation: number }) {
  const gltf = useLoader(GLTFLoader, '/tiny_home/Tiny_House.glb')
  const meshRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (meshRef.current) {
      // Apply scroll-based rotation
      meshRef.current.rotation.y = rotation
    }
  })

  return (
    <group ref={meshRef} scale={[2, 2, 2]} position={[0, -1, 0]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

// Loading component
function ModelLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-white/80 text-lg">Loading 3D Model...</div>
    </div>
  )
}

export default function MenuHome() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [notificationShown, setNotificationShown] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [modelRotation, setModelRotation] = useState(0)
  const [heroOpacity, setHeroOpacity] = useState(1)
  const [titleOpacity, setTitleOpacity] = useState(1)

  // Dropdown states for each menu item
  const [dropdownStates, setDropdownStates] = useState({
    Living_Room: false,
    Kitchen: false,
    Bedroom: false,
    Bathroom: false,
  })

  // Dropdown menu data
  const menuData = {
    Living_Room: ['Samsung TV', 'LED lights', 'Videogame', 'Carpet'],
    Kitchen: ['Oven', 'Microwave', 'Mixer', 'Cooktop'],
    Bedroom: ['Bed', 'Rug', 'Desk', 'Chair'],
    Bathroom: ['Shower', 'Toilet', 'LED lights', 'Towell Hanger'],
  }

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset
      const docHeight = document.documentElement.scrollHeight
      const winHeight = window.innerHeight
      const scrollPercent = (scrollTop / (docHeight - winHeight)) * 100

      setScrollProgress(Math.round(scrollPercent))

      // Calculate 3D model rotation based on scroll (0 to 90 degrees over first 25% scroll)
      const maxRotationScroll = 25 // Complete rotation over first 25% of scroll
      const rotationProgress = Math.min(scrollPercent / maxRotationScroll, 1)
      const newRotation = rotationProgress * (Math.PI / 2) // 90 degrees in radians
      setModelRotation(newRotation)

      // Calculate rotation in degrees for sidebar trigger
      const rotationDegrees = (newRotation * 180) / Math.PI

      // Hero opacity: fade out gradually as model rotates
      let newHeroOpacity
      if (rotationDegrees < 60) {
        // Fade out over first 60 degrees of rotation
        newHeroOpacity = Math.max(1 - (rotationDegrees / 60) * 0.8, 0.2)
      } else {
        // Completely hidden after 60 degrees
        newHeroOpacity = 0
      }
      setHeroOpacity(newHeroOpacity)

      // Title opacity: disappear faster than hero (by 30 degrees rotation)
      let newTitleOpacity
      if (rotationDegrees < 30) {
        newTitleOpacity = Math.max(1 - rotationDegrees / 30, 0)
      } else {
        newTitleOpacity = 0
      }
      setTitleOpacity(newTitleOpacity)

      // Auto-open/close sidebar based on rotation (30 degrees)
      if (rotationDegrees >= 30 && !sidebarOpen) {
        setSidebarOpen(true)

        // Show notification on first auto-open
        if (!notificationShown) {
          setShowNotification(true)
          setTimeout(() => {
            setShowNotification(false)
          }, 3000)
          setNotificationShown(true)
        }
      } else if (rotationDegrees < 30 && sidebarOpen) {
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

    // Throttled scroll event for better performance
    let scrollTimeout: NodeJS.Timeout
    const throttledHandleScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      scrollTimeout = setTimeout(handleScroll, 10)
    }

    window.addEventListener('scroll', throttledHandleScroll)

    // Initial scroll check
    handleScroll()

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [sidebarOpen, notificationShown])

  // Handle ESC key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const closeSidebar = () => {
    setSidebarOpen(false)
    // Close all dropdowns when sidebar closes
    setDropdownStates({
      Living_Room: false,
      Kitchen: false,
      Bedroom: false,
      Bathroom: false,
    })
  }

  const toggleDropdown = (item: string) => {
    setDropdownStates((prev) => ({
      ...prev,
      [item]: !prev[item as keyof typeof prev],
    }))
  }

  // Calculate rotation in degrees for display
  const rotationDegrees = Math.round((modelRotation * 180) / Math.PI)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 z-50 transition-all duration-100 ease-out"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Scroll Indicator */}
      <div
        className={`fixed top-5 left-5 px-4 py-2 rounded-xl text-white text-sm z-50 transition-all duration-300 backdrop-blur-md border border-white/20 ${
          sidebarOpen
            ? 'bg-emerald-500/30 shadow-lg shadow-emerald-500/25'
            : 'bg-white/10 shadow-lg shadow-black/25'
        }`}
      >
        {sidebarOpen
          ? `Sidebar Open (${rotationDegrees}°)`
          : `Model Rotation: ${rotationDegrees}°`}
      </div>

      {/* Dynamic Hero Section with 3D Model - Only render if opacity > 0 */}
      {heroOpacity > 0 && (
        <div
          className="fixed top-0 left-0 w-full h-screen flex items-center justify-center z-5 pointer-events-none"
          style={{
            opacity: heroOpacity,
            transition: 'opacity 0.2s ease-out',
          }}
        >
          <div className="relative w-full max-w-6xl mx-auto px-8">
            {/* Hero Title */}
            <div
              className="text-center mb-6"
              style={{
                opacity: titleOpacity,
                transition: 'opacity 0.1s ease-out',
              }}
            >
              <h1 className="text-7xl md:text-8xl lg:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-12 leading-tight">
                Tiny Homes
              </h1>
              <h2 className="text-2xl md:text-2xl lg:text-2xl font-light text-white/90 tracking-wide mt-3">
                Custom made
              </h2>
              <div className="mt-6 w-32 h-1 bg-gradient-to-r from-cyan-400 to-purple-400 mx-auto rounded-full"></div>
            </div>

            {/* 3D Model Container */}
            <div className="relative w-full max-w-4xl mx-auto h-96">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl shadow-purple-500/20 overflow-hidden h-full">
                {/* Gradient overlay for the container */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-purple-500/10 pointer-events-none rounded-3xl" />

                {/* Three.js Canvas */}
                <div className="relative z-10 rounded-2xl overflow-hidden shadow-xl h-full">
                  <Canvas
                    camera={{ position: [0, 2, 5], fov: 50 }}
                    style={{ background: 'transparent' }}
                  >
                    <Suspense fallback={null}>
                      {/* Lighting */}
                      <ambientLight intensity={0.6} />
                      <directionalLight position={[10, 10, 5]} intensity={1} />
                      <pointLight position={[-10, -10, -10]} intensity={0.5} />

                      {/* Environment for better lighting */}
                      <Environment preset="sunset" />

                      {/* 3D Model */}
                      <TinyHouseModel rotation={modelRotation} />

                      {/* Controls (disabled for scroll-based rotation) */}
                      <OrbitControls
                        enabled={false}
                        enableZoom={false}
                        enablePan={false}
                        enableRotate={false}
                      />
                    </Suspense>
                  </Canvas>
                </div>

                {/* Floating elements around the 3D container */}
                <div className="absolute top-8 right-8 w-4 h-4 bg-cyan-400/40 rounded-full animate-pulse"></div>
                <div
                  className="absolute bottom-8 left-8 w-3 h-3 bg-purple-400/40 rounded-full animate-ping"
                  style={{ animationDelay: '1s' }}
                ></div>
                <div
                  className="absolute top-1/3 left-8 w-2 h-2 bg-pink-400/40 rounded-full animate-pulse"
                  style={{ animationDelay: '2s' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <span>3D Navigation opened at 30° rotation</span>
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
