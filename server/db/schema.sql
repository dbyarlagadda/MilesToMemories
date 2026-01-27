-- MilesToMemories Database Schema
-- PostgreSQL

-- Drop existing tables if they exist
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS trip_photos CASCADE;
DROP TABLE IF EXISTS trip_likes CASCADE;
DROP TABLE IF EXISTS trip_saves CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS social_connections CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    location VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Social connections table
CREATE TABLE social_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'instagram', 'pinterest', 'youtube'
    username VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform)
);

-- Trips table
CREATE TABLE trips (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    date VARCHAR(100),
    description TEXT,
    mood VARCHAR(50),
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip photos table (multiple photos per trip)
CREATE TABLE trip_photos (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip likes table
CREATE TABLE trip_likes (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_id, user_id)
);

-- Trip saves (bookmarks) table
CREATE TABLE trip_saves (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_id, user_id)
);

-- Comments table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_location ON trips(location);
CREATE INDEX idx_trips_created_at ON trips(created_at DESC);
CREATE INDEX idx_comments_trip_id ON comments(trip_id);
CREATE INDEX idx_trip_likes_trip_id ON trip_likes(trip_id);
CREATE INDEX idx_trip_saves_user_id ON trip_saves(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert demo user
INSERT INTO users (email, password_hash, name, avatar_url) VALUES
('demo@milestomemories.com', '$2a$10$XQxBtS3TqZKVKjQKFqYqAOJwXxQxQxQxQxQxQxQxQxQxQxQxQxQxQ', 'Travel Explorer', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop');

-- Insert demo trips
INSERT INTO trips (user_id, title, location, latitude, longitude, date, description, mood, image_url, likes_count) VALUES
(1, 'Whispers of Ancient Temples', 'Kyoto, Japan', 35.0116, 135.7681, 'November 2024', 'Walking through the vermillion gates of Fushimi Inari at dawn, with mist weaving through thousands of torii gates. Kyoto taught me that beauty lives in the quiet moments—in the rustle of bamboo, the precision of a tea ceremony, and the gentle bow of a stranger.', 'peaceful', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80', 847),
(1, 'Lemon Groves & Coastal Dreams', 'Amalfi Coast, Italy', 40.6333, 14.6029, 'September 2024', 'The scent of lemons and sea salt filled every breath. Winding roads carved into cliffs revealed villages painted in sunset colors. Each evening ended with limoncello on terraces overlooking the endless blue.', 'relaxed', 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&q=80', 1203),
(1, 'Above the Clouds', 'Swiss Alps', 46.8182, 8.2275, 'July 2024', 'At 3,000 meters, the world below disappeared into a sea of clouds. The silence was profound—just the crunch of snow underfoot and the distant echo of cowbells. Switzerland reminded me why we climb.', 'adventurous', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80', 2156),
(1, 'Land of Fire and Ice', 'Iceland', 64.9631, -19.0208, 'March 2024', 'Iceland defied every expectation. In two weeks, I witnessed waterfalls that thundered with the force of ancient gods, drove through landscapes that felt borrowed from another planet, and stood beneath the dancing aurora as green light painted the winter sky.', 'adventurous', 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80', 3421),
(1, 'Morning Stillness', 'Lake Bled, Slovenia', 46.3625, 14.0936, 'June 2024', 'I woke at 5am to catch the lake in perfect stillness. The island church reflected like a mirror painting. Some moments are worth losing sleep for.', 'peaceful', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80', 1567),
(1, 'Colors of the Medina', 'Marrakech, Morocco', 31.6295, -7.9811, 'April 2024', 'Lost in the maze of the medina, every turn revealed new colors, scents, and sounds. The chaos was intoxicating, the hospitality overwhelming.', 'excited', 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&q=80', 982),
(1, 'Hidden Waterfall', 'Costa Rica', 9.7489, -83.7534, 'February 2024', 'After a 3-hour jungle trek, we found this hidden paradise. The water was cold and perfect. Nature rewards those who seek.', 'adventurous', 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80', 1834),
(1, 'Fjord Dreams', 'Norway', 60.4720, 8.4689, 'January 2024', 'Sailing through the Norwegian fjords felt like entering another world. Waterfalls cascaded from impossible heights, and the silence was broken only by seabirds.', 'peaceful', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', 2891),
(1, 'Misty Mountains', 'Pacific Northwest, USA', 47.6062, -122.3321, 'December 2023', 'The Pacific Northwest in winter is a study in green and gray. Moss-covered forests, misty mornings, and the smell of pine everywhere.', 'nostalgic', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', 1456);

-- Insert demo comments
INSERT INTO comments (trip_id, user_id, content) VALUES
(1, 1, 'This is absolutely stunning! How long did you spend in Kyoto?'),
(1, 1, 'The temples look magical in the mist!'),
(2, 1, 'Italy is always a good idea!'),
(4, 1, 'Did you see the Northern Lights? That''s my dream!');
