// server.js (Backend API Proxy with Caching and Autocomplete)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // Using node-fetch v2
const cors = require('cors');
const cache = require('memory-cache'); // NEW: Caching library

const app = express();
const PORT = process.env.PORT || 3000;
const apiKey = process.env.SPOONACULAR_API_KEY;

if (!apiKey) {
    console.error("FATAL ERROR: SPOONACULAR_API_KEY not found in .env file!");
    process.exit(1);
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Helper Function for Spoonacular API Calls with Caching ---
async function makeSpoonacularRequest(apiUrl, cacheDurationMinutes = 10) { // Default cache 10 mins
    const cacheKey = `spoonacular_${apiUrl}`; // Simple cache key based on URL
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        console.log(`Cache HIT for: ${cacheKey.replace(apiKey, '***HIDDEN***')}`);
        return cachedData; // Return cached data
    } else {
        console.log(`Cache MISS for: ${cacheKey.replace(apiKey, '***HIDDEN***')}`);
    }

    console.log(`Fetching from Spoonacular: ${apiUrl.replace(apiKey, '***HIDDEN***')}`);
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
            console.error(`Spoonacular API Error: ${response.status} ${response.statusText}`);
            console.error("Spoonacular Response Body:", data);
            const errorMessage = data?.message || `Spoonacular error ${response.status}`;
            const error = new Error(errorMessage);
            error.status = response.status;
            throw error;
        }

        // Cache the successful response
        const cacheDurationMs = cacheDurationMinutes * 60 * 1000;
        cache.put(cacheKey, data, cacheDurationMs);
        console.log(`Cached response for ${cacheDurationMinutes} mins.`);

        return data; // Return fresh data

    } catch (error) {
        console.error("Error during Spoonacular fetch:", error);
        throw error; // Re-throw to be caught by route handler
    }
}


// --- Endpoint for Complex Recipe Search (Handles Sort, Pagination) ---
app.get('/api/recipes', async (req, res) => {
    try {
        const baseUrl = 'https://api.spoonacular.com/recipes/complexSearch';
        const params = new URLSearchParams({
            apiKey: apiKey,
            addRecipeInformation: true,
            fillIngredients: true, // Often useful with recipe info
        });

        // Allowed parameters from frontend + Pagination/Sorting
        const allowedParams = [
            'query', 'includeIngredients', 'excludeIngredients', 'cuisine', 'diet',
            'type', 'maxReadyTime', 'intolerances',
            'sort', 'sortDirection', 'offset', 'number' // Added sort/pagination params
        ];

        allowedParams.forEach(key => {
            if (req.query[key]) {
                params.append(key, req.query[key]);
            }
        });

        // Ensure 'number' has a default if not provided
        if (!params.has('number')) {
            params.append('number', '12'); // Default results per page
        }

        const spoonacularUrl = `${baseUrl}?${params.toString()}`;
        // Use a shorter cache for search results maybe? e.g., 5 minutes
        const recipeData = await makeSpoonacularRequest(spoonacularUrl, 5);

        // Important: Send back the full object including totalResults for pagination
        res.json(recipeData);

    } catch (error) {
        console.error("Error in /api/recipes route:", error.message);
        res.status(error.status || 500).json({ error: error.message || 'An unexpected error occurred on the server searching recipes.' });
    }
});

// --- Endpoint for Getting Recipe Details by ID (Cached) ---
app.get('/api/recipe/:id', async (req, res) => {
    const recipeId = req.params.id;

    if (!recipeId || isNaN(parseInt(recipeId))) {
         return res.status(400).json({ error: 'Valid Recipe ID parameter is required' });
    }

    try {
        const baseUrl = `https://api.spoonacular.com/recipes/${recipeId}/information`;
        const params = new URLSearchParams({
             apiKey: apiKey,
             includeNutrition: true
        });

        const spoonacularUrl = `${baseUrl}?${params.toString()}`;
        // Cache details longer, e.g., 30 minutes
        const recipeDetails = await makeSpoonacularRequest(spoonacularUrl, 30);
        res.json(recipeDetails);

    } catch (error) {
        console.error(`Error in /api/recipe/${recipeId} route:`, error.message);
        res.status(error.status || 500).json({ error: error.message || 'An unexpected error occurred on the server fetching recipe details.' });
    }
});

// --- NEW Endpoint for Ingredient Autocomplete ---
app.get('/api/ingredient-autocomplete', async (req, res) => {
    const query = req.query.query;
    const number = req.query.number || 5; // Limit suggestions

    if (!query) {
        return res.status(400).json({ error: 'Autocomplete query parameter is required' });
    }

    try {
        const baseUrl = 'https://api.spoonacular.com/food/ingredients/autocomplete';
        const params = new URLSearchParams({
            apiKey: apiKey,
            query: query,
            number: number
        });
        const spoonacularUrl = `${baseUrl}?${params.toString()}`;

        // Don't cache autocomplete heavily, or use very short duration (e.g., 1 min)
        const suggestions = await makeSpoonacularRequest(spoonacularUrl, 1);
        res.json(suggestions);

    } catch (error) {
        console.error("Error in /api/ingredient-autocomplete route:", error.message);
         res.status(error.status || 500).json({ error: error.message || 'An unexpected error occurred fetching autocomplete suggestions.' });
    }
});


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Make sure your .env file contains your SPOONACULAR_API_KEY');
});