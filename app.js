class DataLineageApp {
    constructor() {
        this.parser = new SQLParser();
        this.renderer = null;
        this.currentTheme = 'dark';
        this.isColumnView = false;
        
        this.initializeApp();
        this.bindEvents();
    }

    initializeApp() {
        // Initialize the graph renderer
        this.renderer = new GraphRenderer('#graph-container');
        
        // Set initial theme
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.renderer) {
                this.renderer.resize();
            }
        });

        // Add sample query for demonstration
        this.loadSampleQuery();
    }

    bindEvents() {
        // Visualize button
        const visualizeBtn = document.getElementById('visualize-btn');
        visualizeBtn.addEventListener('click', () => this.handleVisualize());

        // Back button
        const backBtn = document.getElementById('back-btn');
        backBtn.addEventListener('click', () => this.showLandingPage());

        // View toggle
        const viewToggle = document.getElementById('view-toggle');
        viewToggle.addEventListener('click', () => this.toggleView());

        // Reset zoom button
        const resetZoomBtn = document.getElementById('reset-zoom');
        resetZoomBtn.addEventListener('click', () => {
            if (this.renderer) {
                this.renderer.resetZoom();
            }
        });

        // Theme toggle
        const themeToggleBtn = document.getElementById('theme-toggle');
        themeToggleBtn.addEventListener('click', () => this.toggleTheme());

        // Close sidebar
        const closeSidebarBtn = document.getElementById('close-sidebar');
        closeSidebarBtn.addEventListener('click', () => this.closeSidebar());

        // Enter key in textarea
        const sqlQuery = document.getElementById('sql-query');
        sqlQuery.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.handleVisualize();
            }
        });

        // Escape key to close sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSidebar();
            }
        });
    }

    loadSampleQuery() {
        const sampleQuery = `-- Customer Analytics Pipeline
WITH customer_metrics AS (
    SELECT 
        c.customer_id,
        c.email,
        c.first_name,
        c.last_name,
        COUNT(o.order_id) as total_orders,
        SUM(o.total_amount) as total_spent,
        AVG(o.total_amount) as avg_order_value,
        MAX(o.order_date) as last_order_date
    FROM bronze.customers c
    LEFT JOIN bronze.orders o ON c.customer_id = o.customer_id
    WHERE c.created_at >= '2023-01-01'
    GROUP BY c.customer_id, c.email, c.first_name, c.last_name
),
customer_segments AS (
    SELECT 
        customer_id,
        email,
        first_name || ' ' || last_name as customer_name,
        total_orders,
        total_spent,
        avg_order_value,
        CASE 
            WHEN total_spent > 1000 THEN 'High Value'
            WHEN total_spent > 500 THEN 'Medium Value'
            ELSE 'Low Value'
        END as customer_segment,
        CASE 
            WHEN last_order_date < CURRENT_DATE - INTERVAL '90 days' THEN 'High'
            WHEN last_order_date < CURRENT_DATE - INTERVAL '30 days' THEN 'Medium'
            ELSE 'Low'
        END as churn_risk
    FROM customer_metrics
)
SELECT 
    cs.customer_id,
    cs.customer_name,
    cs.customer_segment,
    cs.total_orders,
    cs.total_spent,
    cs.avg_order_value,
    cs.churn_risk,
    CURRENT_TIMESTAMP as calculated_at
FROM customer_segments cs
WHERE cs.total_orders > 0
ORDER BY cs.total_spent DESC;`;

        document.getElementById('sql-query').value = sampleQuery;
    }

    handleVisualize() {
        const sqlQuery = document.getElementById('sql-query').value.trim();
        
        if (!sqlQuery) {
            this.showNotification('Please enter a SQL query', 'error');
            return;
        }

        try {
            // For demonstration, we'll use sample data
            // In a real implementation, you'd parse the actual query
            const data = this.parser.generateSampleData();
            
            // Show visualization page
            this.showVisualizationPage();
            
            // Render the graph
            setTimeout(() => {
                this.renderer.render(data, this.isColumnView);
            }, 300);

        } catch (error) {
            console.error('Error parsing SQL:', error);
            this.showNotification('Error parsing SQL query', 'error');
        }
    }

    showLandingPage() {
        const landingPage = document.getElementById('landing-page');
        const vizPage = document.getElementById('visualization-page');
        
        vizPage.classList.remove('active');
        setTimeout(() => {
            landingPage.classList.add('active');
        }, 250);
        
        this.closeSidebar();
    }

    showVisualizationPage() {
        const landingPage = document.getElementById('landing-page');
        const vizPage = document.getElementById('visualization-page');
        
        landingPage.classList.remove('active');
        setTimeout(() => {
            vizPage.classList.add('active');
        }, 250);
    }

    toggleView() {
        const toggle = document.getElementById('view-toggle');
        const isActive = toggle.classList.contains('active');
        
        if (isActive) {
            toggle.classList.remove('active');
            this.isColumnView = false;
        } else {
            toggle.classList.add('active');
            this.isColumnView = true;
        }

        // Update the renderer
        if (this.renderer) {
            this.renderer.toggleView();
        }

        // Add satisfying click animation
        toggle.style.transform = 'scale(0.95)';
        setTimeout(() => {
            toggle.style.transform = 'scale(1)';
        }, 150);
    }

    toggleTheme() {
        const themeBtn = document.getElementById('theme-toggle');
        
        if (this.currentTheme === 'dark') {
            this.currentTheme = 'light';
            document.documentElement.setAttribute('data-theme', 'light');
            themeBtn.textContent = 'Dark Mode';
        } else {
            this.currentTheme = 'dark';
            document.documentElement.setAttribute('data-theme', 'dark');
            themeBtn.textContent = 'Light Mode';
        }

        // Animate theme transition
        document.body.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    }

    closeSidebar() {
        const sidebar = document.getElementById('metadata-sidebar');
        sidebar.classList.remove('open');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-primary);
            box-shadow: 0 4px 12px var(--shadow-dark);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 1rem;
            max-width: 300px;
            animation: slideInRight 0.3s ease;
        `;

        if (type === 'error') {
            notification.style.borderColor = 'var(--accent-orange)';
            notification.style.background = 'rgba(255, 107, 53, 0.1)';
        }

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    // Utility method to add CSS animations
    addAnimationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            .metadata-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem 0;
                border-bottom: 1px solid var(--border-color);
            }

            .metadata-item:last-child {
                border-bottom: none;
            }

            .metadata-item label {
                font-weight: 600;
                color: var(--text-secondary);
            }

            .metadata-item span {
                color: var(--text-primary);
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.9rem;
            }

            .node.dimmed {
                opacity: 0.3;
            }

            .node rect.highlighted {
                filter: drop-shadow(0 0 12px currentColor);
                stroke-width: 3;
            }

            .link.highlighted {
                stroke-width: 4;
                filter: drop-shadow(0 0 8px currentColor);
            }

            .link.dimmed {
                opacity: 0.1;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new DataLineageApp();
    app.addAnimationStyles();
    
    // Add some easter eggs for the starship theme
    console.log(`
    🚀 Data Lineage Cartographer v1.0
    ═══════════════════════════════════
    Welcome aboard, Data Navigator!
    
    Commands:
    - Ctrl+Enter: Visualize query
    - Escape: Close sidebar
    - Double-click: Reset zoom
    
    May your data flow be ever clear! ✨
    `);
});
