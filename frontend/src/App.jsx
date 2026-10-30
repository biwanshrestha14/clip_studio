import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Film, 
  Search, 
  ExternalLink, 
  Sliders, 
  FileSpreadsheet,
  Trophy,
  Tag
} from 'lucide-react';

function InstagramIcon({ size = 24, color = "currentColor", style }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      style={style}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

const SPORTS_CATEGORIES = [
  { id: 'All', label: 'All Sports', icon: '⚡' },
  { id: 'WNBA', label: 'WNBA', icon: '🏀' },
  { id: 'NBA', label: 'NBA', icon: '🏀' },
  { id: 'NFL', label: 'NFL', icon: '🏈' },
  { id: 'Soccer', label: 'Soccer', icon: '⚽' },
];

export default function App() {
  const [clips, setClips] = useState([]);
  const [activeClip, setActiveClip] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [downloadCategory, setDownloadCategory] = useState('auto');
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Video player state
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Edit caption & category state
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editHashtags, setEditHashtags] = useState('');
  const [editCategory, setEditCategory] = useState('WNBA');
  
  // Feedback & Copy state
  const [copySuccess, setCopySuccess] = useState(false);
  const [toast, setToast] = useState(null);

  // Fetch all clips on mount
  const fetchClips = async () => {
    try {
      const res = await fetch('/api/clips');
      if (res.ok) {
        const data = await res.json();
        setClips(data);
        if (data.length > 0 && !activeClip) {
          setActiveClip(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch clips:', err);
    }
  };

  useEffect(() => {
    fetchClips();
  }, []);

  // Update active clip helper
  const handleSelectClip = (clip) => {
    setActiveClip(clip);
    setIsEditing(false);
    setIsPlaying(false);
  };

  // Video time formatting
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Video event handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleLoop = () => {
    if (!videoRef.current) return;
    videoRef.current.loop = !isLooping;
    setIsLooping(!isLooping);
  };

  const handleSpeedChange = () => {
    if (!videoRef.current) return;
    const speeds = [1, 1.25, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    videoRef.current.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Download new Instagram Reel
  const handleDownload = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsDownloading(true);
    showToast('Connecting to Instagram and downloading reel...', 'info');

    try {
      const payload = {
        url: urlInput.trim(),
        category: downloadCategory === 'auto' ? null : downloadCategory
      };

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Download failed');
      }

      const newClip = await res.json();
      setUrlInput('');
      await fetchClips();
      setActiveClip(newClip);
      showToast(`Reel downloaded & tagged as ${newClip.category || 'Sports'}! ✨`, 'success');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text, label = 'Copied to clipboard!') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      showToast(label, 'success');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  // Show Toast
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Start edit
  const startEdit = () => {
    if (!activeClip) return;
    setEditCaption(activeClip.caption || '');
    setEditHashtags(activeClip.hashtag_str || '');
    setEditCategory(activeClip.category || 'WNBA');
    setIsEditing(true);
  };

  // Save edit
  const saveEdit = async () => {
    if (!activeClip) return;
    try {
      const res = await fetch('/api/update-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeClip.id,
          caption: editCaption,
          hashtag_str: editHashtags,
          category: editCategory,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setActiveClip(updated);
        await fetchClips();
        setIsEditing(false);
        showToast(`Clip updated & categorized under ${editCategory}!`, 'success');
      }
    } catch (err) {
      showToast('Failed to save clip details', 'error');
    }
  };

  // Delete clip
  const handleDeleteClip = async (clipId) => {
    if (!window.confirm('Are you sure you want to delete this clip and its video file?')) return;
    try {
      const res = await fetch(`/api/clips/${clipId}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = clips.filter((c) => c.id !== clipId);
        setClips(remaining);
        if (activeClip?.id === clipId) {
          setActiveClip(remaining.length > 0 ? remaining[0] : null);
        }
        showToast('Clip deleted', 'info');
      }
    } catch (err) {
      showToast('Failed to delete clip', 'error');
    }
  };

  // Filter clips by Category AND Search Query
  const filteredClips = clips.filter((clip) => {
    const matchesCategory = 
      selectedCategory === 'All' || 
      (clip.category || 'Other').toLowerCase() === selectedCategory.toLowerCase();

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (clip.caption || '').toLowerCase().includes(q) ||
      (clip.hashtag_str || '').toLowerCase().includes(q) ||
      (clip.category || '').toLowerCase().includes(q) ||
      (clip.id || '').toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  // Calculate statistics
  const totalClips = clips.length;
  const totalMB = (clips.reduce((acc, c) => acc + (c.file_size || 0), 0) / (1024 * 1024)).toFixed(1);

  // Helper for badge CSS
  const getBadgeClass = (category) => {
    const c = (category || '').toLowerCase();
    if (c === 'wnba') return 'sport-badge wnba';
    if (c === 'nba') return 'sport-badge nba';
    if (c === 'nfl') return 'sport-badge nfl';
    if (c === 'soccer') return 'sport-badge soccer';
    return 'sport-badge other';
  };

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <Check size={18} /> : <Sparkles size={18} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <InstagramIcon size={24} />
          </div>
          <div>
            <h1 className="brand-title">ReelSync Studio</h1>
            <p className="brand-subtitle">American Sports Hub • WNBA • NFL • NBA • Soccer</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="status-badge">
            <span className="status-dot"></span>
            <span>Sports Engine Active</span>
          </div>
          <div className="stat-pill">
            <span>Clips:</span>
            <strong>{totalClips}</strong>
          </div>
          <div className="stat-pill">
            <span>Storage:</span>
            <strong>{totalMB} MB</strong>
          </div>
        </div>
      </header>

      {/* Download Input Bar with Category Selector */}
      <section className="download-section">
        <form onSubmit={handleDownload} className="download-form">
          <div className="input-wrapper">
            <InstagramIcon style={{ position: 'absolute', left: '18px', color: 'var(--text-muted)', pointerEvents: 'none' }} size={20} />
            <input
              type="text"
              className="url-input"
              placeholder="Paste Instagram Reel URL (e.g., https://www.instagram.com/reel/DfCrRXPT7zI/)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={isDownloading}
            />
          </div>

          <select 
            className="category-select"
            value={downloadCategory}
            onChange={(e) => setDownloadCategory(e.target.value)}
            disabled={isDownloading}
            title="Select sport category or auto-detect"
          >
            <option value="auto">⚡ Auto-Detect Sport</option>
            <option value="WNBA">🏀 WNBA</option>
            <option value="NBA">🏀 NBA</option>
            <option value="NFL">🏈 NFL</option>
            <option value="Soccer">⚽ Soccer</option>
          </select>

          <button type="submit" className="btn-primary" disabled={isDownloading || !urlInput.trim()}>
            {isDownloading ? (
              <>
                <span className="spinner"></span>
                <span>Downloading & Categorizing...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Download Reel</span>
              </>
            )}
          </button>
        </form>
      </section>

      {/* Sports Category Filter Tabs */}
      <nav className="category-nav">
        {SPORTS_CATEGORIES.map((cat) => {
          const count = cat.id === 'All' 
            ? clips.length 
            : clips.filter((c) => (c.category || '').toLowerCase() === cat.id.toLowerCase()).length;
          const isActive = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`category-tab ${isActive ? 'active' : ''}`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className="category-tab-badge">{count}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Studio Synchronizer */}
      {activeClip ? (
        <main className="studio-layout">
          {/* Left Column: Synchronized Video Player */}
          <div className="player-card">
            <div className="player-header">
              <div className="player-title">
                <Film size={20} color="#ff007f" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px' }}>{activeClip.video_filename}</span>
                <span className={getBadgeClass(activeClip.category)}>
                  {activeClip.category || 'WNBA'}
                </span>
              </div>
              <a
                href={activeClip.url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <span>Instagram</span>
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="video-frame-wrapper">
              <video
                ref={videoRef}
                src={activeClip.video_url}
                className="video-element"
                loop={isLooping}
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onClick={togglePlay}
                playsInline
              />
            </div>

            {/* Custom Interactive Player Controls */}
            <div className="player-controls">
              <button onClick={togglePlay} className="ctrl-btn" title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                style={{
                  flex: 1,
                  accentColor: 'var(--accent-pink)',
                  cursor: 'pointer',
                  height: '4px',
                }}
              />

              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <button onClick={toggleMute} className="ctrl-btn" title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <button
                onClick={toggleLoop}
                className={`ctrl-btn ${isLooping ? 'active' : ''}`}
                title="Toggle Loop"
              >
                <RotateCcw size={16} />
              </button>

              <button onClick={handleSpeedChange} className="ctrl-btn" title="Playback Speed">
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {playbackSpeed}x
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Synchronized Caption & Hashtag Hub */}
          <div className="sync-card">
            <div className="sync-header">
              <div className="sync-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2>Synchronized Content</h2>
                  <span className={getBadgeClass(activeClip.category)}>
                    {activeClip.category || 'WNBA'}
                  </span>
                </div>
                <p className="sync-subtitle">Ready-to-post caption & hashtags synced to this Reel</p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {!isEditing ? (
                  <button onClick={startEdit} className="btn-secondary" title="Edit caption and category">
                    <Edit3 size={15} />
                    <span>Edit</span>
                  </button>
                ) : (
                  <>
                    <button onClick={saveEdit} className="btn-primary" style={{ padding: '8px 16px' }}>
                      <Save size={15} />
                      <span>Save</span>
                    </button>
                    <button onClick={() => setIsEditing(false)} className="btn-secondary" style={{ padding: '8px 12px' }}>
                      <X size={15} />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => handleDeleteClip(activeClip.id)} 
                  className="btn-secondary" 
                  style={{ color: '#ef4444' }}
                  title="Delete clip"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Hero Copy Box: Single Cell Copy with Caption + Hashtags */}
            <div className="hero-copy-box">
              <div className="hero-copy-header">
                <span className="badge-hero">
                  <Sparkles size={14} />
                  <span>1-Click Full Cell Copy</span>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Caption + Hashtags combined
                </span>
              </div>

              <button
                onClick={() =>
                  copyToClipboard(
                    activeClip.caption_and_hashtags,
                    'Copied combined caption & hashtags! Ready to paste! 🚀'
                  )
                }
                className={`btn-hero-copy ${copySuccess ? 'copied' : ''}`}
              >
                {copySuccess ? <Check size={20} /> : <Copy size={20} />}
                <span>{copySuccess ? 'Copied to Clipboard!' : 'Copy Caption & Hashtags'}</span>
              </button>

              <div className="caption-preview-block">
                {activeClip.caption_and_hashtags || 'No caption text available'}
              </div>
            </div>

            {/* Editable or Split View */}
            {isEditing ? (
              <div className="edit-box">
                <div>
                  <label className="section-label" style={{ marginBottom: '8px' }}>
                    Sport Category
                  </label>
                  <select
                    className="category-select"
                    style={{ width: '100%' }}
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                  >
                    <option value="WNBA">🏀 WNBA</option>
                    <option value="NBA">🏀 NBA</option>
                    <option value="NFL">🏈 NFL</option>
                    <option value="Soccer">⚽ Soccer</option>
                  </select>
                </div>
                <div>
                  <label className="section-label" style={{ marginBottom: '8px' }}>
                    Edit Caption Text
                  </label>
                  <textarea
                    className="edit-textarea"
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Enter clean caption text..."
                  />
                </div>
                <div>
                  <label className="section-label" style={{ marginBottom: '8px' }}>
                    Edit Hashtags (space separated)
                  </label>
                  <input
                    type="text"
                    className="url-input"
                    value={editHashtags}
                    onChange={(e) => setEditHashtags(e.target.value)}
                    placeholder="#reel #viral #trend..."
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Hashtags Section */}
                <div className="hashtags-container">
                  <div className="section-label">
                    <span>Hashtags ({activeClip.hashtags?.length || 0})</span>
                    {activeClip.hashtag_str && (
                      <button
                        onClick={() => copyToClipboard(activeClip.hashtag_str, 'Hashtags copied!')}
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        <Copy size={12} />
                        <span>Copy Hashtags</span>
                      </button>
                    )}
                  </div>

                  <div className="hashtag-cloud">
                    {activeClip.hashtags && activeClip.hashtags.length > 0 ? (
                      activeClip.hashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="hashtag-chip"
                          onClick={() => copyToClipboard(tag, `Copied ${tag}`)}
                          title="Click to copy single hashtag"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No hashtags detected</span>
                    )}
                  </div>
                </div>

                {/* Content Counts / Instagram Safety Metrics */}
                <div className="counts-bar">
                  <div className="count-item">
                    <span className="count-number">{(activeClip.caption || '').length}</span>
                    <span className="count-label">Characters (Max 2,200)</span>
                  </div>
                  <div className="count-item">
                    <span className="count-number">
                      {(activeClip.caption || '').split(/\s+/).filter(Boolean).length}
                    </span>
                    <span className="count-label">Words</span>
                  </div>
                  <div className="count-item">
                    <span className="count-number">{activeClip.hashtags?.length || 0}</span>
                    <span className="count-label">Hashtags (Max 30)</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      ) : (
        <div className="player-empty" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <InstagramIcon size={48} color="#ff007f" />
          <h3>No Clips Found in this Category</h3>
          <p>Download a new Reel above or select "All Sports" to view all clips!</p>
        </div>
      )}

      {/* Gallery & Clip Queue Section */}
      <section className="gallery-section">
        <div className="gallery-header">
          <div className="gallery-title">
            <Sliders size={20} color="#ff007f" />
            <span>
              {selectedCategory === 'All' ? 'All Clips Library' : `${selectedCategory} Clips Library`} ({filteredClips.length})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="input-wrapper" style={{ width: '260px' }}>
              <Search className="input-icon" size={16} />
              <input
                type="text"
                className="url-input"
                style={{ padding: '8px 12px 8px 38px', fontSize: '13px' }}
                placeholder="Search captions, tags, sport..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <a 
              href="/captions.csv" 
              download="captions.csv" 
              className="btn-secondary" 
              style={{ padding: '8px 14px', fontSize: '13px' }}
              title="Download the updated captions.csv"
            >
              <FileSpreadsheet size={16} color="#10b981" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        <div className="gallery-grid">
          {filteredClips.map((clip) => {
            const isActive = activeClip?.id === clip.id;
            return (
              <div
                key={clip.id}
                className={`clip-card ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectClip(clip)}
              >
                <div className="clip-card-thumb">
                  <video src={clip.video_url} preload="metadata" muted />
                  <div className="thumb-overlay">
                    <span className={getBadgeClass(clip.category)}>
                      {clip.category || 'WNBA'}
                    </span>
                    <span className="thumb-badge" style={{ color: '#38bdf8' }}>
                      {clip.hashtags?.length || 0} tags
                    </span>
                  </div>
                </div>

                <div className="clip-card-body">
                  <p className="clip-card-caption">
                    {clip.caption || 'No caption text'}
                  </p>

                  <div className="clip-card-footer">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {clip.video_filename} • {(clip.file_size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <span style={{ color: isActive ? 'var(--accent-pink)' : 'inherit', fontWeight: 600 }}>
                      {isActive ? '● Active' : 'Click to View'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
