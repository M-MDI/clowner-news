const API_BASE = 'https://hacker-news.firebaseio.com/v0';
let currentTab = 'top';
let page = 0;
let loading = false;
let newStories = [];
let loadedItems = new Set();

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

function formatRelativeTime(timestamp) {
    const seconds = Math.floor((new Date() - timestamp * 1000) / 1000);
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    return 'just now';
}

async function fetchStoryIds(type) {
    const endpoints = {
        top: 'topstories',
        new: 'newstories',
        best: 'beststories',
        ask: 'askstories',
        show: 'showstories',
        job: 'jobstories'
    };

    try {
        const response = await fetch(`${API_BASE}/${endpoints[type]}.json`);
        const ids = await response.json();
        return ids.slice(page * 10, (page * 10) + 10);
    } catch (error) {
        console.error('Error fetching story IDs:', error);
        return [];
    }
}

async function fetchItemDetails(id) {
    try {
        const response = await fetch(`${API_BASE}/item/${id}.json`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching item details:', error);
        return null;
    }
}

function createStoryElement(story) {
    if (!story || loadedItems.has(story.id)) return null;
    loadedItems.add(story.id);

    const storyEl = document.createElement('article');
    storyEl.className = 'story';
    
    const link = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    
    storyEl.innerHTML = `
        <div class="story-header">
            <a href="${link}" target="_blank" class="story-title">
                ${story.title}
            </a>
            <div class="story-meta">
                ${story.score ? `${story.score} points ·` : ''} 
                by ${story.by} · 
                ${formatRelativeTime(story.time)} · 
                ${story.descendants || 0} comments
            </div>
        </div>
        ${story.text ? `<div class="story-content">${story.text}</div>` : ''}
    `;
    
    return storyEl;
}

async function loadStories() {
    if (loading) return;
    loading = true;
    
    document.querySelector('.loading').style.display = 'block';
    
    const ids = await fetchStoryIds(currentTab);
    const stories = await Promise.all(ids.map(id => fetchItemDetails(id)));
    
    const storiesContainer = document.querySelector('.stories');
    stories
        .filter(Boolean)
        .map(createStoryElement)
        .filter(Boolean)
        .forEach(storyEl => storiesContainer.appendChild(storyEl));
    
    loading = false;
    document.querySelector('.loading').style.display = 'none';
}

const checkForUpdates = throttle(async () => {
    try {
        const response = await fetch(`${API_BASE}/updates.json`);
        const { items } = await response.json();
        
        const newItems = [];
        for (const id of items.slice(0, 5)) {
            if (!loadedItems.has(id)) {
                const details = await fetchItemDetails(id);
                if (details && !details.deleted && !details.dead) {
                    newItems.push(details);
                }
            }
        }
        
        if (newItems.length > 0) {
            newStories = [...newItems, ...newStories].slice(0, 5);
            document.querySelector('.live-update-alert').style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}, 5000);

 function showNewStories() {
    const storiesContainer = document.querySelector('.stories');
    newStories
        .map(createStoryElement)
        .filter(Boolean)
        .forEach(storyEl => {
            storiesContainer.insertBefore(storyEl, storiesContainer.firstChild);
        });
    
    newStories = [];
    document.querySelector('.live-update-alert').style.display = 'none';
}

document.querySelector('.tabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('tab')) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        e.target.classList.add('active');
        
        currentTab = e.target.dataset.type;
        page = 0;
        loadedItems.clear();
        document.querySelector('.stories').innerHTML = '';
        loadStories();
    }
});

window.addEventListener('scroll', throttle(() => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
        page++;
        loadStories();
    }
}, 500));

loadStories();
setInterval(checkForUpdates, 5000);
