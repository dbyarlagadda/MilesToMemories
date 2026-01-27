import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_URL = 'http://localhost:5001/api';
const SERVER_URL = 'http://localhost:5001';

// Geocoding cache utilities
const GEOCODE_CACHE_KEY = 'travelDiary_geocodeCache';

// Pre-seed cache with known locations for instant display
const INITIAL_COORDS = {
  'Paris, France': [48.8566, 2.3522],
  'Bali, Indonesia': [-8.4095, 115.1889],
  'Tokyo, Japan': [35.6762, 139.6503],
  'New York, USA': [40.7128, -74.0060],
  'London, UK': [51.5074, -0.1278],
  'Sydney, Australia': [-33.8688, 151.2093],
  'Rome, Italy': [41.9028, 12.4964],
  'Barcelona, Spain': [41.3851, 2.1734],
};

const getGeocodeCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY));
    return cached || { ...INITIAL_COORDS };
  } catch {
    return { ...INITIAL_COORDS };
  }
};

const setGeocodeCache = (cache) => {
  localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
};

// Initialize cache with pre-seeded locations on first load
if (!localStorage.getItem(GEOCODE_CACHE_KEY)) {
  setGeocodeCache(INITIAL_COORDS);
}

const geocodeLocation = async (location) => {
  // Check cache first
  const cache = getGeocodeCache();
  if (cache[location]) {
    return cache[location];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
      { headers: { 'User-Agent': 'TravelDiaryApp/1.0' } }
    );
    const data = await response.json();

    if (data && data.length > 0) {
      const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      // Cache the result
      cache[location] = coords;
      setGeocodeCache(cache);
      return coords;
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }

  return [20, 0]; // Default fallback
};

function App() {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    title: '', location: '', date: '', description: '', mood: 'neutral'
  });
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const fileInputRef = useRef(null);

  const [activeView, setActiveView] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMood, setFilterMood] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [lightbox, setLightbox] = useState({ isOpen: false, photos: [], currentIndex: 0 });
  const [showForm, setShowForm] = useState(false);

  // Social features state
  const [favorites, setFavorites] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Geocoding state
  const [entryCoords, setEntryCoords] = useState({});
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const [shareToast, setShareToast] = useState(null);

  useEffect(() => {
    fetchEntries();
    fetchFavorites();
  }, []);

  useEffect(() => {
    filterAndSortEntries();
  }, [entries, searchQuery, filterMood, sortBy]);

  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  // Geocode entries when they change
  useEffect(() => {
    const geocodeEntries = async () => {
      const newCoords = { ...entryCoords };
      let hasNewCoords = false;

      for (const entry of entries) {
        if (!newCoords[entry.id]) {
          newCoords[entry.id] = await geocodeLocation(entry.location);
          hasNewCoords = true;
        }
      }

      if (hasNewCoords) {
        setEntryCoords(newCoords);
      }
    };

    if (entries.length > 0) {
      geocodeEntries();
    }
  }, [entries]);

  const fetchEntries = async () => {
    try {
      const response = await fetch(`${API_URL}/entries`);
      const data = await response.json();
      setEntries(data);
      setFilteredEntries(data);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const response = await fetch(`${API_URL}/favorites`);
      const data = await response.json();
      setFavorites(data);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const filterAndSortEntries = () => {
    let result = [...entries];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(entry =>
        entry.title.toLowerCase().includes(query) ||
        entry.location.toLowerCase().includes(query) ||
        entry.description.toLowerCase().includes(query)
      );
    }
    if (filterMood !== 'all') {
      result = result.filter(entry => entry.mood === filterMood);
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return new Date(b.date) - new Date(a.date);
        case 'date-asc': return new Date(a.date) - new Date(b.date);
        case 'title': return a.title.localeCompare(b.title);
        case 'location': return a.location.localeCompare(b.location);
        default: return 0;
      }
    });
    setFilteredEntries(result);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedPhotos(prev => [...prev, ...files]);
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
  };

  const removeSelectedPhoto = (index) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = async (entryId, photoUrl) => {
    if (editingEntry) {
      setExistingPhotos(prev => prev.filter(p => p !== photoUrl));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formDataToSend = new FormData();
    Object.keys(formData).forEach(key => formDataToSend.append(key, formData[key]));
    selectedPhotos.forEach(photo => formDataToSend.append('photos', photo));

    try {
      if (editingEntry) {
        formDataToSend.append('existingPhotos', JSON.stringify(existingPhotos));
        const response = await fetch(`${API_URL}/entries/${editingEntry.id}`, {
          method: 'PUT', body: formDataToSend
        });
        const updatedEntry = await response.json();
        setEntries(entries.map(e => e.id === editingEntry.id ? updatedEntry : e));
        setEditingEntry(null);
      } else {
        const response = await fetch(`${API_URL}/entries`, {
          method: 'POST', body: formDataToSend
        });
        const newEntry = await response.json();
        setEntries([newEntry, ...entries]);
      }
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', location: '', date: '', description: '', mood: 'neutral' });
    setSelectedPhotos([]);
    setExistingPhotos([]);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title, location: entry.location, date: entry.date,
      description: entry.description, mood: entry.mood
    });
    setExistingPhotos(entry.photos || []);
    setSelectedPhotos([]);
    setPreviewUrls([]);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await fetch(`${API_URL}/entries/${id}`, { method: 'DELETE' });
      setEntries(entries.filter(e => e.id !== id));
      if (selectedEntry?.id === id) setSelectedEntry(null);
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleCancel = () => {
    setEditingEntry(null);
    resetForm();
    setShowForm(false);
  };

  // Lightbox
  const openLightbox = (photos, index) => setLightbox({ isOpen: true, photos, currentIndex: index });
  const closeLightbox = () => setLightbox({ isOpen: false, photos: [], currentIndex: 0 });
  const navigateLightbox = (direction) => {
    setLightbox(prev => ({
      ...prev,
      currentIndex: (prev.currentIndex + direction + prev.photos.length) % prev.photos.length
    }));
  };

  // Favorites
  const toggleFavorite = async (entryId) => {
    try {
      const response = await fetch(`${API_URL}/favorites/${entryId}`, { method: 'POST' });
      const data = await response.json();
      if (data.favorited) {
        setFavorites([...favorites, entryId]);
      } else {
        setFavorites(favorites.filter(id => id !== entryId));
      }
      setEntries(entries.map(e => e.id === entryId ? { ...e, favorites: data.count } : e));
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Comments
  const addComment = async (entryId) => {
    if (!commentText.trim() || !commentAuthor.trim()) return;
    try {
      const response = await fetch(`${API_URL}/entries/${entryId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: commentAuthor, text: commentText })
      });
      const comment = await response.json();
      setEntries(entries.map(e => e.id === entryId ? {
        ...e, comments: [...(e.comments || []), comment]
      } : e));
      setSelectedEntry(prev => prev ? {
        ...prev, comments: [...(prev.comments || []), comment]
      } : null);
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const deleteComment = async (entryId, commentId) => {
    try {
      await fetch(`${API_URL}/entries/${entryId}/comments/${commentId}`, { method: 'DELETE' });
      setEntries(entries.map(e => e.id === entryId ? {
        ...e, comments: e.comments.filter(c => c.id !== commentId)
      } : e));
      setSelectedEntry(prev => prev ? {
        ...prev, comments: prev.comments.filter(c => c.id !== commentId)
      } : null);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Share
  const shareEntry = (entry, platform) => {
    const url = `${window.location.origin}/entry/${entry.id}`;
    const text = `Check out my trip: ${entry.title} in ${entry.location}`;

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        break;
      case 'copy':
        navigator.clipboard.writeText(url);
        setShareToast('Link copied to clipboard!');
        setTimeout(() => setShareToast(null), 3000);
        break;
      default:
        break;
    }
  };

  // Newsletter
  const subscribeNewsletter = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail })
      });
      const data = await response.json();
      if (response.ok) {
        setNewsletterStatus({ type: 'success', message: data.message });
        setNewsletterEmail('');
      } else {
        setNewsletterStatus({ type: 'error', message: data.error });
      }
      setTimeout(() => setNewsletterStatus(null), 5000);
    } catch (error) {
      setNewsletterStatus({ type: 'error', message: 'Failed to subscribe' });
    }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const getStats = () => {
    const countries = new Set(entries.map(e => e.location.split(', ').pop()));
    const totalPhotos = entries.reduce((sum, e) => sum + (e.photos?.length || 0), 0);
    return { trips: entries.length, countries: countries.size, photos: totalPhotos };
  };

  const stats = getStats();

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>Travel Diary</h1>
            <p>Document your adventures around the world</p>
          </div>
          <button className="btn btn-primary add-entry-btn" onClick={() => setShowForm(true)}>
            + New Entry
          </button>
        </div>
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-number">{stats.trips}</span>
            <span className="stat-label">Trips</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.countries}</span>
            <span className="stat-label">Countries</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.photos}</span>
            <span className="stat-label">Photos</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{favorites.length}</span>
            <span className="stat-label">Favorites</span>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="controls">
        <div className="view-toggles">
          {['grid', 'timeline', 'map'].map(view => (
            <button key={view} className={`view-btn ${activeView === view ? 'active' : ''}`}
              onClick={() => setActiveView(view)}>
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
        <div className="filters">
          <input type="text" placeholder="Search trips..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
          <select value={filterMood} onChange={(e) => setFilterMood(e.target.value)} className="filter-select">
            <option value="all">All Moods</option>
            <option value="excited">Excited</option>
            <option value="relaxed">Relaxed</option>
            <option value="adventurous">Adventurous</option>
            <option value="nostalgic">Nostalgic</option>
            <option value="neutral">Neutral</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="title">By Title</option>
            <option value="location">By Location</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <main className="main-content-full">
        {loading ? (
          <div className="loading">Loading your adventures...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="no-entries">
            <h3>No entries found</h3>
            <p>{entries.length === 0 ? 'Start documenting your travels!' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {activeView === 'grid' && (
              <div className="entries-grid">
                {filteredEntries.map(entry => (
                  <div key={entry.id} className="entry-card">
                    {entry.photos && entry.photos.length > 0 && (
                      <div className="card-image" onClick={() => openLightbox(entry.photos, 0)}>
                        <img src={`${SERVER_URL}${entry.photos[0]}`} alt={entry.title} />
                        {entry.photos.length > 1 && <span className="photo-count">+{entry.photos.length - 1}</span>}
                      </div>
                    )}
                    <div className="card-content">
                      <div className="card-header">
                        <h3 className="entry-title">{entry.title}</h3>
                        <button className={`favorite-btn ${favorites.includes(entry.id) ? 'favorited' : ''}`}
                          onClick={() => toggleFavorite(entry.id)}>
                          {favorites.includes(entry.id) ? '★' : '☆'}
                        </button>
                      </div>
                      <p className="entry-location">{entry.location}</p>
                      <p className="entry-date">{formatDate(entry.date)}</p>
                      {entry.description && (
                        <p className="entry-description">{entry.description.substring(0, 100)}...</p>
                      )}
                      <div className="card-social">
                        <span className={`mood-badge mood-${entry.mood}`}>
                          {entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1)}
                        </span>
                        <div className="social-stats">
                          <span className="comment-count" onClick={() => setSelectedEntry(entry)}>
                            {entry.comments?.length || 0} comments
                          </span>
                        </div>
                      </div>
                      <div className="share-buttons">
                        <button className="share-btn" onClick={() => shareEntry(entry, 'twitter')}>Twitter</button>
                        <button className="share-btn" onClick={() => shareEntry(entry, 'facebook')}>Facebook</button>
                        <button className="share-btn" onClick={() => shareEntry(entry, 'copy')}>Copy Link</button>
                      </div>
                      <div className="card-actions">
                        <button className="btn btn-small btn-secondary" onClick={() => handleEdit(entry)}>Edit</button>
                        <button className="btn btn-small btn-danger" onClick={() => handleDelete(entry.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline View */}
            {activeView === 'timeline' && (
              <div className="timeline">
                {filteredEntries.map((entry, index) => (
                  <div key={entry.id} className={`timeline-item ${index % 2 === 0 ? 'left' : 'right'}`}>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <div className="timeline-date">{formatDate(entry.date)}</div>
                        <button className={`favorite-btn ${favorites.includes(entry.id) ? 'favorited' : ''}`}
                          onClick={() => toggleFavorite(entry.id)}>
                          {favorites.includes(entry.id) ? '★' : '☆'}
                        </button>
                      </div>
                      <h3>{entry.title}</h3>
                      <p className="timeline-location">{entry.location}</p>
                      {entry.photos && entry.photos.length > 0 && (
                        <div className="timeline-photos">
                          {entry.photos.slice(0, 3).map((photo, i) => (
                            <img key={i} src={`${SERVER_URL}${photo}`} alt={`${entry.title} ${i + 1}`}
                              onClick={() => openLightbox(entry.photos, i)} />
                          ))}
                        </div>
                      )}
                      {entry.description && <p className="timeline-desc">{entry.description}</p>}
                      <div className="timeline-footer">
                        <span className={`mood-badge mood-${entry.mood}`}>
                          {entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1)}
                        </span>
                        <span className="comment-count" onClick={() => setSelectedEntry(entry)}>
                          {entry.comments?.length || 0} comments
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Map View */}
            {activeView === 'map' && (
              <div className="map-container">
                <MapContainer center={[20, 0]} zoom={2} style={{ height: '500px', width: '100%', borderRadius: '12px' }}>
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {filteredEntries.map(entry => (
                    <Marker key={entry.id} position={entryCoords[entry.id] || [20, 0]}>
                      <Popup>
                        <div className="map-popup">
                          <strong>{entry.title}</strong>
                          <p>{entry.location}</p>
                          <p>{formatDate(entry.date)}</p>
                          {entry.photos?.[0] && (
                            <img src={`${SERVER_URL}${entry.photos[0]}`} alt={entry.title} style={{ width: '150px', borderRadius: '4px' }} />
                          )}
                          <button className="btn btn-small" onClick={() => setSelectedEntry(entry)}>View Details</button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
          </>
        )}
      </main>

      {/* Newsletter Section */}
      <section className="newsletter-section">
        <div className="newsletter-content">
          <h3>Subscribe to Our Newsletter</h3>
          <p>Get travel tips and inspiration delivered to your inbox</p>
          <form onSubmit={subscribeNewsletter} className="newsletter-form">
            <input type="email" placeholder="Enter your email" value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)} required />
            <button type="submit" className="btn btn-primary">Subscribe</button>
          </form>
          {newsletterStatus && (
            <p className={`newsletter-status ${newsletterStatus.type}`}>{newsletterStatus.message}</p>
          )}
        </div>
      </section>

      {/* Entry Detail Modal with Comments */}
      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEntry.title}</h2>
              <button className="close-btn" onClick={() => setSelectedEntry(null)}>&times;</button>
            </div>
            <div className="detail-content">
              <div className="detail-info">
                <p className="detail-location">{selectedEntry.location}</p>
                <p className="detail-date">{formatDate(selectedEntry.date)}</p>
                <span className={`mood-badge mood-${selectedEntry.mood}`}>
                  {selectedEntry.mood.charAt(0).toUpperCase() + selectedEntry.mood.slice(1)}
                </span>
              </div>
              {selectedEntry.photos && selectedEntry.photos.length > 0 && (
                <div className="detail-photos">
                  {selectedEntry.photos.map((photo, i) => (
                    <img key={i} src={`${SERVER_URL}${photo}`} alt={`${selectedEntry.title} ${i + 1}`}
                      onClick={() => openLightbox(selectedEntry.photos, i)} />
                  ))}
                </div>
              )}
              <p className="detail-description">{selectedEntry.description}</p>

              {/* Share Section */}
              <div className="detail-share">
                <span>Share this trip:</span>
                <button className="share-btn" onClick={() => shareEntry(selectedEntry, 'twitter')}>Twitter</button>
                <button className="share-btn" onClick={() => shareEntry(selectedEntry, 'facebook')}>Facebook</button>
                <button className="share-btn" onClick={() => shareEntry(selectedEntry, 'copy')}>Copy Link</button>
              </div>

              {/* Comments Section */}
              <div className="comments-section">
                <h4>Comments ({selectedEntry.comments?.length || 0})</h4>
                <div className="comments-list">
                  {selectedEntry.comments?.map(comment => (
                    <div key={comment.id} className="comment">
                      <div className="comment-header">
                        <strong>{comment.author}</strong>
                        <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                        <button className="delete-comment" onClick={() => deleteComment(selectedEntry.id, comment.id)}>&times;</button>
                      </div>
                      <p>{comment.text}</p>
                    </div>
                  ))}
                </div>
                <div className="add-comment">
                  <input type="text" placeholder="Your name" value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)} />
                  <textarea placeholder="Write a comment..." value={commentText}
                    onChange={(e) => setCommentText(e.target.value)} />
                  <button className="btn btn-primary" onClick={() => addComment(selectedEntry.id)}>Post Comment</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entry Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEntry ? 'Edit Entry' : 'New Entry'}</h2>
              <button className="close-btn" onClick={handleCancel}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="title">Title</label>
                  <input type="text" id="title" name="title" value={formData.title}
                    onChange={handleInputChange} placeholder="e.g., Amazing day in Tokyo" required />
                </div>
                <div className="form-group">
                  <label htmlFor="location">Location</label>
                  <input type="text" id="location" name="location" value={formData.location}
                    onChange={handleInputChange} placeholder="e.g., Tokyo, Japan" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="date">Date</label>
                  <input type="date" id="date" name="date" value={formData.date}
                    onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label htmlFor="mood">Mood</label>
                  <select id="mood" name="mood" value={formData.mood} onChange={handleInputChange}>
                    <option value="excited">Excited</option>
                    <option value="relaxed">Relaxed</option>
                    <option value="adventurous">Adventurous</option>
                    <option value="nostalgic">Nostalgic</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea id="description" name="description" value={formData.description}
                  onChange={handleInputChange} placeholder="Write about your experience..." rows="4" />
              </div>
              <div className="form-group">
                <label>Photos</label>
                <div className="photo-upload-area">
                  <input type="file" id="photos" ref={fileInputRef} onChange={handlePhotoChange}
                    accept="image/jpeg,image/png,image/gif,image/webp" multiple className="photo-input" />
                  <label htmlFor="photos" className="photo-upload-label">Click to add photos</label>
                </div>
                {existingPhotos.length > 0 && (
                  <div className="photo-previews">
                    <p className="preview-label">Current Photos:</p>
                    <div className="preview-grid">
                      {existingPhotos.map((photo, index) => (
                        <div key={`existing-${index}`} className="preview-item">
                          <img src={`${SERVER_URL}${photo}`} alt={`Existing ${index + 1}`} />
                          <button type="button" className="remove-photo"
                            onClick={() => removeExistingPhoto(editingEntry?.id, photo)}>&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {previewUrls.length > 0 && (
                  <div className="photo-previews">
                    <p className="preview-label">New Photos:</p>
                    <div className="preview-grid">
                      {previewUrls.map((url, index) => (
                        <div key={`new-${index}`} className="preview-item">
                          <img src={url} alt={`Preview ${index + 1}`} />
                          <button type="button" className="remove-photo"
                            onClick={() => removeSelectedPhoto(index)}>&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingEntry ? 'Update Entry' : 'Add Entry'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox.isOpen && (
        <div className="lightbox" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox}>&times;</button>
          <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}>&lt;</button>
          <img src={`${SERVER_URL}${lightbox.photos[lightbox.currentIndex]}`} alt="Gallery" onClick={(e) => e.stopPropagation()} />
          <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}>&gt;</button>
          <div className="lightbox-counter">{lightbox.currentIndex + 1} / {lightbox.photos.length}</div>
        </div>
      )}

      {/* Toast */}
      {shareToast && <div className="toast">{shareToast}</div>}
    </div>
  );
}

export default App;
