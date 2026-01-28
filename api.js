// MilesToMemories API Client
// Use production URL for the hosted site, localhost for local development
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'http://milestomemories.mooo.com:3000/api';
const API_BASE = API_BASE_URL; // Alias for login.html

class MilesToMemoriesAPI {
    constructor() {
        this.token = localStorage.getItem('authToken');
    }

    // Helper method for API calls
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    }

    // Auth methods
    async register(email, password, name) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        this.token = data.token;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    logout() {
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    }

    // Trip methods
    async getTrips(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/trips?${queryString}` : '/trips';
        return this.request(endpoint);
    }

    async getTrip(id) {
        return this.request(`/trips/${id}`);
    }

    async createTrip(tripData) {
        return this.request('/trips', {
            method: 'POST',
            body: JSON.stringify(tripData)
        });
    }

    async updateTrip(id, tripData) {
        return this.request(`/trips/${id}`, {
            method: 'PUT',
            body: JSON.stringify(tripData)
        });
    }

    async deleteTrip(id) {
        return this.request(`/trips/${id}`, {
            method: 'DELETE'
        });
    }

    async likeTrip(id) {
        return this.request(`/trips/${id}/like`, {
            method: 'POST'
        });
    }

    async unlikeTrip(id) {
        return this.request(`/trips/${id}/like`, {
            method: 'DELETE'
        });
    }

    async saveTrip(id) {
        return this.request(`/trips/${id}/save`, {
            method: 'POST'
        });
    }

    async unsaveTrip(id) {
        return this.request(`/trips/${id}/save`, {
            method: 'DELETE'
        });
    }

    async getTripsByDestination(destination) {
        return this.request(`/trips/destination/${encodeURIComponent(destination)}`);
    }

    // User methods
    async updateProfile(profileData) {
        return this.request('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    async getSocialConnections() {
        return this.request('/users/social');
    }

    async updateSocialConnections(connections) {
        return this.request('/users/social', {
            method: 'PUT',
            body: JSON.stringify(connections)
        });
    }

    async getUserTrips() {
        return this.request('/users/trips');
    }

    async getSavedTrips() {
        return this.request('/users/saved');
    }

    async getUserStats() {
        return this.request('/users/stats');
    }

    // Comment methods
    async getComments(tripId) {
        return this.request(`/comments/trip/${tripId}`);
    }

    async addComment(tripId, content) {
        return this.request(`/comments/trip/${tripId}`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    }

    async deleteComment(id) {
        return this.request(`/comments/${id}`, {
            method: 'DELETE'
        });
    }
}

// Create global API instance
const api = new MilesToMemoriesAPI();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MilesToMemoriesAPI, api };
}
