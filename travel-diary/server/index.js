const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// In-memory storage
let diaryEntries = [
  {
    id: '1',
    title: 'Trip to Paris',
    location: 'Paris, France',
    date: '2024-03-15',
    description: 'Visited the Eiffel Tower and enjoyed croissants at a local café. The city lights at night were magical!',
    mood: 'excited',
    photos: [],
    favorites: 0,
    comments: [
      { id: 'c1', author: 'Sarah', text: 'Paris is amazing! Did you visit the Louvre?', createdAt: '2024-03-16T10:30:00Z' },
      { id: 'c2', author: 'Mike', text: 'The croissants there are the best!', createdAt: '2024-03-16T14:20:00Z' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Beach Day in Bali',
    location: 'Bali, Indonesia',
    date: '2024-02-20',
    description: 'Spent the day surfing and watching the sunset. The beaches here are absolutely stunning.',
    mood: 'relaxed',
    photos: [],
    favorites: 0,
    comments: [
      { id: 'c3', author: 'Emma', text: 'Which beach was this? I\'m planning a trip!', createdAt: '2024-02-21T08:15:00Z' }
    ],
    createdAt: new Date().toISOString()
  }
];

// Favorites storage (in production, this would be per-user)
let userFavorites = [];

// Newsletter subscribers
let newsletterSubscribers = [];

// Get all diary entries
app.get('/api/entries', (req, res) => {
  res.json(diaryEntries.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// Get single entry
app.get('/api/entries/:id', (req, res) => {
  const entry = diaryEntries.find(e => e.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  res.json(entry);
});

// Create new entry with photos
app.post('/api/entries', upload.array('photos', 10), (req, res) => {
  const { title, location, date, description, mood } = req.body;

  if (!title || !location || !date) {
    return res.status(400).json({ error: 'Title, location, and date are required' });
  }

  const photos = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

  const newEntry = {
    id: uuidv4(),
    title,
    location,
    date,
    description: description || '',
    mood: mood || 'neutral',
    photos,
    favorites: 0,
    comments: [],
    createdAt: new Date().toISOString()
  };

  diaryEntries.push(newEntry);
  res.status(201).json(newEntry);
});

// Update entry
app.put('/api/entries/:id', upload.array('photos', 10), (req, res) => {
  const index = diaryEntries.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const { title, location, date, description, mood, existingPhotos } = req.body;

  let photos = [];
  if (existingPhotos) {
    try {
      photos = JSON.parse(existingPhotos);
    } catch (e) {
      photos = diaryEntries[index].photos || [];
    }
  } else {
    photos = diaryEntries[index].photos || [];
  }

  if (req.files && req.files.length > 0) {
    const newPhotos = req.files.map(file => `/uploads/${file.filename}`);
    photos = [...photos, ...newPhotos];
  }

  diaryEntries[index] = {
    ...diaryEntries[index],
    title: title || diaryEntries[index].title,
    location: location || diaryEntries[index].location,
    date: date || diaryEntries[index].date,
    description: description !== undefined ? description : diaryEntries[index].description,
    mood: mood || diaryEntries[index].mood,
    photos
  };

  res.json(diaryEntries[index]);
});

// Delete a photo from an entry
app.delete('/api/entries/:id/photos', (req, res) => {
  const index = diaryEntries.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const { photoUrl } = req.body;
  diaryEntries[index].photos = diaryEntries[index].photos.filter(p => p !== photoUrl);

  const filePath = path.join(__dirname, photoUrl);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json(diaryEntries[index]);
});

// Delete entry
app.delete('/api/entries/:id', (req, res) => {
  const index = diaryEntries.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const entry = diaryEntries[index];
  if (entry.photos) {
    entry.photos.forEach(photoUrl => {
      const filePath = path.join(__dirname, photoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }

  diaryEntries.splice(index, 1);
  userFavorites = userFavorites.filter(id => id !== req.params.id);
  res.status(204).send();
});

// ==================== COMMENTS ====================

// Add comment to entry
app.post('/api/entries/:id/comments', (req, res) => {
  const index = diaryEntries.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const { author, text } = req.body;
  if (!author || !text) {
    return res.status(400).json({ error: 'Author and text are required' });
  }

  const comment = {
    id: uuidv4(),
    author,
    text,
    createdAt: new Date().toISOString()
  };

  if (!diaryEntries[index].comments) {
    diaryEntries[index].comments = [];
  }
  diaryEntries[index].comments.push(comment);

  res.status(201).json(comment);
});

// Delete comment
app.delete('/api/entries/:entryId/comments/:commentId', (req, res) => {
  const entryIndex = diaryEntries.findIndex(e => e.id === req.params.entryId);
  if (entryIndex === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const commentIndex = diaryEntries[entryIndex].comments.findIndex(c => c.id === req.params.commentId);
  if (commentIndex === -1) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  diaryEntries[entryIndex].comments.splice(commentIndex, 1);
  res.status(204).send();
});

// ==================== FAVORITES ====================

// Get user favorites
app.get('/api/favorites', (req, res) => {
  res.json(userFavorites);
});

// Toggle favorite
app.post('/api/favorites/:id', (req, res) => {
  const entryIndex = diaryEntries.findIndex(e => e.id === req.params.id);
  if (entryIndex === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  const favIndex = userFavorites.indexOf(req.params.id);
  if (favIndex === -1) {
    userFavorites.push(req.params.id);
    diaryEntries[entryIndex].favorites = (diaryEntries[entryIndex].favorites || 0) + 1;
    res.json({ favorited: true, count: diaryEntries[entryIndex].favorites });
  } else {
    userFavorites.splice(favIndex, 1);
    diaryEntries[entryIndex].favorites = Math.max(0, (diaryEntries[entryIndex].favorites || 1) - 1);
    res.json({ favorited: false, count: diaryEntries[entryIndex].favorites });
  }
});

// ==================== NEWSLETTER ====================

// Subscribe to newsletter
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (newsletterSubscribers.includes(email)) {
    return res.status(400).json({ error: 'Email already subscribed' });
  }

  newsletterSubscribers.push(email);
  res.status(201).json({ message: 'Successfully subscribed to newsletter!' });
});

// Get subscriber count (for display)
app.get('/api/newsletter/count', (req, res) => {
  res.json({ count: newsletterSubscribers.length });
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
