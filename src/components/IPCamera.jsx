import React, { useEffect, useRef, useState, useCallback } from 'react'
import jsQR from 'jsqr'
import './IPCamera.css'

function IPCamera ({ onAlert, onConnectionChange }) {
  const videoRef = useRef(null)
  const scannerVideoRef = useRef(null)
  const scannerCanvasRef = useRef(null)
  const scannerStreamRef = useRef(null)
  const scannerRafRef = useRef(null)
  const scannerTimeoutRef = useRef(null)
  const [ipAddress, setIpAddress] = useState('')
  const [port, setPort] = useState('8080')
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [connectionQuality, setConnectionQuality] = useState('Good')
  const [signalStrength, setSignalStrength] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  // Parse a decoded QR string into { ip, port }.
  // Handles full URLs (http://192.168.1.5:8080[/video]), bare host:port,
  // and IP-only (defaults port to 8080, the IP Webcam default).
  const parseQrText = useCallback((text) => {
    const raw = (text || '').trim()
    if (!raw) return null

    let candidate = raw
    // Strip protocol if present
    candidate = candidate.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
    // Drop path/query/fragment
    candidate = candidate.split('/')[0].split('?')[0].split('#')[0]

    // candidate is now like "192.168.1.5:8080" or "host.local" or "192.168.1.5"
    const lastColon = candidate.lastIndexOf(':')
    let host = candidate
    let portStr = ''

    if (lastColon > -1) {
      // Distinguish IPv6 (multiple colons) from host:port. For IPv6 we keep the whole thing as host.
      const afterColon = candidate.slice(lastColon + 1)
      if (/^\d+$/.test(afterColon)) {
        host = candidate.slice(0, lastColon)
        portStr = afterColon
      }
    }

    if (!host) return null
    return { ip: host, port: portStr || '8080' }
  }, [])

  const connectToCamera = (overrideIp, overridePort) => {
    const ip = overrideIp !== undefined ? overrideIp : ipAddress
    const portVal = overridePort !== undefined ? overridePort : port

    if (!ip) {
      setConnectionError('Please enter an IP address')
      return
    }

    setIsConnecting(true)
    setConnectionError('')

    // Construct the stream URL (common IP camera formats)
    // Most IP camera apps use MJPEG streams at /video or /mjpeg
    const url = `http://${ip}:${portVal}/video`
    setStreamUrl(url)

    // Try to load the stream
    const img = new Image()
    img.onload = () => {
      setIsConnected(true)
      setIsConnecting(false)
      setSignalStrength(Math.floor(80 + Math.random() * 20))
      onConnectionChange?.(true)
      onAlert?.('IP camera connected successfully')
    }
    img.onerror = () => {
      setIsConnecting(false)
      setConnectionError('Failed to connect to IP camera. Check IP address and port.')
      setIsConnected(false)
      onConnectionChange?.(false)
      onAlert?.('IP camera connection failed')
    }
    img.src = url

    // Set timeout for connection
    setTimeout(() => {
      if (isConnecting) {
        setIsConnecting(false)
        if (!isConnected) {
          setConnectionError('Connection timeout. Check if camera is accessible.')
          onConnectionChange?.(false)
        }
      }
    }, 10000)
  }

  const disconnectCamera = () => {
    setIsConnected(false)
    setStreamUrl('')
    setSignalStrength(0)
    onConnectionChange?.(false)
    onAlert?.('IP camera disconnected')
  }

  const handleTestConnection = () => {
    connectToCamera()
  }

  // Stop the QR scanner camera stream and cancel any pending timers/frames.
  const stopScanner = useCallback(() => {
    if (scannerRafRef.current) {
      cancelAnimationFrame(scannerRafRef.current)
      scannerRafRef.current = null
    }
    if (scannerTimeoutRef.current) {
      clearTimeout(scannerTimeoutRef.current)
      scannerTimeoutRef.current = null
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach(t => t.stop())
      scannerStreamRef.current = null
    }
    if (scannerVideoRef.current) {
      scannerVideoRef.current.srcObject = null
    }
    setIsScanning(false)
  }, [])

  // Decode a single video frame to a canvas and run jsQR on it.
  const decodeFrame = useCallback(() => {
    const video = scannerVideoRef.current
    const canvas = scannerCanvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scannerRafRef.current = requestAnimationFrame(decodeFrame)
      return
    }

    const width = video.videoWidth || 320
    const height = video.videoHeight || 240
    if (width === 0 || height === 0) {
      scannerRafRef.current = requestAnimationFrame(decodeFrame)
      return
    }

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, 0, 0, width, height)

    let imageData
    try {
      imageData = ctx.getImageData(0, 0, width, height)
    } catch (err) {
      // getImageData can throw if the stream origin is not usable; stop scanning.
      setScanError('Unable to read camera frame. Try again.')
      stopScanner()
      return
    }

    const code = jsQR(imageData.data, width, height)
    if (code && code.data) {
      const parsed = parseQrText(code.data)
      if (parsed) {
        setIpAddress(parsed.ip)
        setPort(parsed.port)
        setScanError('')
        stopScanner()
        onAlert?.(`QR detected: ${parsed.ip}:${parsed.port}`)
        // Connect with the parsed values directly to avoid stale-state reads.
        connectToCamera(parsed.ip, parsed.port)
        return
      }
      setScanError('QR did not contain a valid IP/port. Try the QR shown in your IP camera app.')
    }

    scannerRafRef.current = requestAnimationFrame(decodeFrame)
  }, [parseQrText, stopScanner])

  const startScanner = useCallback(async () => {
    setScanError('')
    setConnectionError('')
    if (isScanning) return
    setIsScanning(true)

    let stream
    try {
      // Prefer the rear/environment camera so the student can point the laptop
      // at the phone screen; fall back to the default/user camera.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      })
    } catch (err) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch (err2) {
        setScanError('Camera access denied. Allow camera permissions to scan the QR code.')
        setIsScanning(false)
        return
      }
    }

    scannerStreamRef.current = stream
    if (scannerVideoRef.current) {
      scannerVideoRef.current.srcObject = stream
      await scannerVideoRef.current.play().catch(() => {})
    }

    // Safety timeout: stop scanning after 20s of no QR.
    scannerTimeoutRef.current = setTimeout(() => {
      setScanError('No QR code detected in time. Try again or enter the IP/port manually.')
      stopScanner()
    }, 20000)

    scannerRafRef.current = requestAnimationFrame(decodeFrame)
  }, [isScanning, decodeFrame, stopScanner])

  // Release the scanner camera if the component unmounts mid-scan.
  useEffect(() => {
    return () => stopScanner()
  }, [stopScanner])

  useEffect(() => {
    if (isConnected) {
      const signalInterval = setInterval(() => {
        setSignalStrength(prev => {
          const newStrength = Math.max(60, Math.min(100, prev + (Math.random() - 0.5) * 10))
          return Math.floor(newStrength)
        })

        setConnectionQuality(prev => {
          if (signalStrength > 80) return 'Excellent'
          if (signalStrength > 60) return 'Good'
          return 'Poor'
        })
      }, 2000)

      return () => clearInterval(signalInterval)
    }
  }, [isConnected, signalStrength])

  return (
    <div className="ip-camera">
      <div className="camera-header">
        <h3>📹 IP Camera</h3>
        <div className={`status-indicator ${isConnected ? 'active' : 'inactive'}`}>
          {isConnecting ? '○ Connecting...' : isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      {!isConnected && (
        <div className="ip-config">
          <div className="config-form">
            <div className="form-group">
              <label htmlFor="ip-address">IP Address:</label>
              <input
                id="ip-address"
                type="text"
                placeholder="e.g., 192.168.1.100"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="ip-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="port">Port:</label>
              <input
                id="port"
                type="text"
                placeholder="e.g., 8080"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="port-input"
              />
            </div>
            <button
              onClick={handleTestConnection}
              disabled={isConnecting}
              className="connect-btn"
            >
              {isConnecting ? 'Connecting...' : 'Connect Camera'}
            </button>
            <button
              onClick={startScanner}
              disabled={isConnecting || isScanning}
              className="scan-qr-btn"
            >
              {isScanning ? 'Scanning...' : 'Scan QR Code'}
            </button>
          </div>

          {isScanning && (
            <div className="qr-scanner">
              <video
                ref={scannerVideoRef}
                className="scanner-video"
                playsInline
                muted
              />
              <canvas ref={scannerCanvasRef} className="scanner-canvas" />
              <div className="scanner-overlay" />
              <div className="scanner-hint">
                Point your laptop camera at the QR code shown in your phone's IP camera app.
              </div>
              <button onClick={stopScanner} className="cancel-scan-btn">
                Cancel
              </button>
            </div>
          )}

          {scanError && (
            <div className="error-message">
              ⚠️ {scanError}
            </div>
          )}

          {connectionError && (
            <div className="error-message">
              ⚠️ {connectionError}
            </div>
          )}

          <div className="help-text">
            <h4>How to use IP Camera:</h4>
            <ol>
              <li>Install an IP camera app on your phone (e.g., IP Webcam, Alfred Camera)</li>
              <li>Start the server on your phone</li>
              <li>Enter the IP address and port shown in the app — or tap "Scan QR Code" and point your laptop camera at the QR shown in the app to auto-connect</li>
              <li>Click "Connect Camera" to start monitoring</li>
            </ol>
            <p className="note">
              <strong>Note:</strong> Both devices must be on the same network for direct IP access.
            </p>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="video-container">
          <img
            ref={videoRef}
            src={streamUrl}
            alt="IP Camera Stream"
            className="ip-stream"
            onError={() => {
              setConnectionError('Stream lost. Reconnecting...')
              setIsConnected(false)
              onConnectionChange?.(false)
            }}
          />
          
          <div className="camera-controls">
            <button onClick={disconnectCamera} className="disconnect-btn">
              Disconnect
            </button>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="camera-stats">
          <div className="stat">
            <span className="stat-label">Signal Strength:</span>
            <div className="signal-bar">
              <div 
                className="signal-fill" 
                style={{ width: `${signalStrength}%` }}
              />
              <span className="signal-value">{signalStrength}%</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-label">Connection Quality:</span>
            <span className={`stat-value ${connectionQuality === 'Excellent' ? 'good' : connectionQuality === 'Good' ? 'warning' : 'bad'}`}>
              {connectionQuality}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Stream URL:</span>
            <span className="stat-value">{ipAddress}:{port}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Protocol:</span>
            <span className="stat-value">HTTP (MJPEG)</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default IPCamera
