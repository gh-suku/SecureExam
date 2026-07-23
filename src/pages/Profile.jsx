import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { auth, db } from '../lib/supabase'
import './Profile.css'

function Profile ({ user }) {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  })
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    loadUserData()
  }, [user])

  const loadUserData = async () => {
    if (!user) return

    try {
      const { data } = await db.getUser(user.id)
      setUserData(data)
      setFormData({
        full_name: data?.full_name || '',
        phone: data?.phone || ''
      })
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  // const manuallyHandel =(e)=>{
  //   setFormData({
  //     <div styleName={styles.format}></div>
  //   })
  // }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await db.updateUser(user.id, formData)
      
      if (error) throw error
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setEditing(false)
      loadUserData()
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await auth.signOut()
    window.location.href = '/'
  }

  if (loading && !userData) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <nav className="dashboard-nav">
        <div className="nav-container">
          <div className="logo">
            <svg className="logo-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span className="logo-text">SecureExam</span>
          </div>
          <div className="nav-links">
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <Link to="/history" className="nav-link">History</Link>
            <Link to="/profile" className="nav-link active">Profile</Link>
            <button onClick={handleLogout} className="nav-link btn-logout">Logout</button>
          </div>
        </div>
      </nav>

      <div className="profile-content">
        <div className="profile-container">
          <div className="profile-header">
            <h1>My Profile</h1>
            <button 
              className="btn btn-secondary"
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {message.text && (
            <div className={`alert ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="profile-card">
            <div className="profile-avatar">
              <div className="avatar-placeholder">
                {userData?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>

            {editing ? (
              <form className="profile-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="full_name">Full Name</label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="disabled"
                  />
                  <small>Email cannot be changed</small>
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <input
                    id="role"
                    type="text"
                    value={userData?.role || 'student'}
                    disabled
                    className="disabled"
                  />
                  <small>Contact admin to change role</small>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-details">
                <div className="detail-row">
                  <span className="detail-label">Full Name</span>
                  <span className="detail-value">{userData?.full_name || 'Not set'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{user?.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{userData?.phone || 'Not set'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{userData?.role || 'student'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Member Since</span>
                  <span className="detail-value">
                    {userData?.created_at ? new Date(userData.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="profile-sections">
            <div className="section-card">
              <h3>Account Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-number">{user?.created_at ? Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0}</span>
                  <span className="stat-label">Days Active</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{userData?.role === 'admin' ? 'Admin' : 'Student'}</span>
                  <span className="stat-label">Account Type</span>
                </div>
              </div>
            </div>

            <div className="section-card">
              <h3>Security</h3>
              <div className="security-info">
                <div className="security-item">
                  <span className="security-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  <div>
                    <h4>Password</h4>
                    <p>Last changed recently</p>
                  </div>
                  <button className="btn btn-small">Change</button>
                </div>
                <div className="security-item">
                  <span className="security-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </span>
                  <div>
                    <h4>Email Verified</h4>
                    <p>{user?.email_confirmed_at ? 'Verified' : 'Not verified'}</p>
                  </div>
                  <span className={`status-badge ${user?.email_confirmed_at ? 'verified' : 'unverified'}`}>
                    {user?.email_confirmed_at ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
