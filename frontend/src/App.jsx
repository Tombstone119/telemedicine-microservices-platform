import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkServices()
    const interval = setInterval(checkServices, 10000)
    return () => clearInterval(interval)
  }, [])

  const checkServices = async () => {
    const serviceList = [
      { name: 'Auth Service', url: '/api/auth/health', port: 3000 },
      { name: 'Patient Service', url: '/api/patients/health', port: 3001 },
      { name: 'Doctor Service', url: '/api/doctors/health', port: 3002 },
      { name: 'Appointment Service', url: '/api/appointments/health', port: 3003 },
      { name: 'Telemedicine Service', url: '/api/telemedicine/health', port: 3004 },
      { name: 'Payment Service', url: '/api/payments/health', port: 3005 },
      { name: 'Notification Service', url: '/api/notifications/health', port: 3006 },
    ]

    const results = await Promise.all(
      serviceList.map(async (service) => {
        try {
          const response = await axios.get(service.url)
          return { ...service, status: 'online', data: response.data }
        } catch (error) {
          return { ...service, status: 'offline', error: error.message }
        }
      })
    )
    setServices(results)
    setLoading(false)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🏥 Healthcare Telemedicine Platform</h1>
        <p>Distributed Systems - SE3020</p>
      </header>

      <div className="dashboard">
        <h2>System Status</h2>
        {loading ? (
          <div className="loading">Checking services...</div>
        ) : (
          <div className="services">
            {services.map((service) => (
              <div key={service.name} className={`service-card ${service.status}`}>
                <h3>{service.name}</h3>
                <div className={`status-badge ${service.status}`}>
                  {service.status === 'online' ? '✅ Online' : '❌ Offline'}
                </div>
                {service.data && (
                  <div className="service-data">
                    <pre>{JSON.stringify(service.data, null, 2)}</pre>
                  </div>
                )}
                {service.error && (
                  <div className="error-message">
                    Error: {service.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="info">
        <h3>Available Services:</h3>
        <ul>
          <li>📧 Notification Service - Email/SMS notifications</li>
          <li>💰 Payment Service - Stripe integration</li>
          <li>🎥 Telemedicine Service - Video consultations</li>
          <li>📅 Appointment Service - Schedule management</li>
          <li>👨‍⚕️ Doctor Service - Doctor profiles</li>
          <li>👤 Patient Service - Patient records</li>
          <li>🔐 Auth Service - Authentication</li>
        </ul>
      </div>

      <div className="links">
        <h3>Access Points:</h3>
        <ul>
          <li><a href="http://localhost:15672" target="_blank">RabbitMQ Management UI</a> (guest/guest)</li>
          <li><a href="http://localhost:5432" target="_blank">PostgreSQL</a> (admin/secret)</li>
          <li><a href="http://localhost:6379" target="_blank">Redis</a></li>
        </ul>
      </div>
    </div>
  )
}

export default App
