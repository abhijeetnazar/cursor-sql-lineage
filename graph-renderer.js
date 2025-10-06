class GraphRenderer {
    constructor(containerId) {
        this.container = d3.select(containerId);
        this.svg = this.container.select('svg');
        this.width = 0;
        this.height = 0;
        this.isColumnView = false;
        this.currentData = null;
        
        // Graph elements
        this.g = null;
        this.links = null;
        this.nodes = null;
        this.simulation = null;
        
        // Zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });
            
        this.setupSVG();
        this.setupDefinitions();
    }

    setupSVG() {
        // Set up responsive SVG
        this.updateDimensions();
        
        this.svg
            .call(this.zoom)
            .on('dblclick.zoom', null); // Disable double-click zoom

        // Main group for all graph elements
        this.g = this.svg.append('g').attr('class', 'graph-group');
        
        // Background for zoom/pan
        this.svg.insert('rect', ':first-child')
            .attr('class', 'background')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'transparent');
    }

    setupDefinitions() {
        const defs = this.svg.append('defs');
        
        // Gradient definitions for links
        const gradient = defs.append('linearGradient')
            .attr('id', 'link-gradient')
            .attr('gradientUnits', 'userSpaceOnUse');
            
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#00d4ff')
            .attr('stop-opacity', 0.8);
            
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#00ff88')
            .attr('stop-opacity', 0.8);

        // Glow filter
        const filter = defs.append('filter')
            .attr('id', 'glow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '200%')
            .attr('height', '200%');

        filter.append('feGaussianBlur')
            .attr('stdDeviation', '3')
            .attr('result', 'coloredBlur');

        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Arrow marker
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 15)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#00d4ff');
    }

    updateDimensions() {
        const rect = this.container.node().getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.svg.attr('width', this.width).attr('height', this.height);
    }

    render(data, isColumnView = false) {
        this.currentData = data;
        this.isColumnView = isColumnView;
        
        // Show loading
        this.showLoading();
        
        // Prepare data for visualization
        const graphData = this.prepareGraphData(data, isColumnView);
        
        // Animate the rendering
        setTimeout(() => {
            this.renderGraph(graphData);
            this.hideLoading();
        }, 500);
    }

    prepareGraphData(data, isColumnView) {
        const nodes = [];
        const links = [];
        
        if (isColumnView) {
            // Column-level visualization
            data.tables.forEach(table => {
                table.columns.forEach(column => {
                    nodes.push({
                        id: `${table.id}.${column.name}`,
                        label: column.name,
                        table: table.id,
                        tableName: table.name,
                        type: 'column',
                        group: this.getTableGroup(table.name)
                    });
                });
            });
            
            // Create column-level links
            data.relationships.forEach(rel => {
                if (rel.sourceColumn && rel.targetColumn && 
                    rel.sourceColumn !== '*' && rel.targetColumn !== '*') {
                    links.push({
                        source: `${rel.source}.${rel.sourceColumn}`,
                        target: `${rel.target}.${rel.targetColumn}`,
                        type: rel.type
                    });
                }
            });
        } else {
            // Table-level visualization
            data.tables.forEach(table => {
                nodes.push({
                    id: table.id,
                    label: table.name,
                    type: 'table',
                    columnCount: table.columns.length,
                    group: this.getTableGroup(table.name)
                });
            });
            
            // Create table-level links
            data.relationships.forEach(rel => {
                links.push({
                    source: rel.source,
                    target: rel.target,
                    type: rel.type
                });
            });
        }
        
        return { nodes, links };
    }

    getTableGroup(tableName) {
        // Determine table group based on schema/prefix
        if (tableName.includes('bronze')) return 'bronze';
        if (tableName.includes('silver')) return 'silver';
        if (tableName.includes('gold')) return 'gold';
        return 'default';
    }

    renderGraph(data) {
        // Clear existing graph
        this.g.selectAll('*').remove();
        
        // Create simulation
        this.simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.links).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(60));

        // Create links
        this.links = this.g.append('g')
            .attr('class', 'links')
            .selectAll('path')
            .data(data.links)
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('stroke', 'url(#link-gradient)')
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('marker-end', 'url(#arrowhead)')
            .style('opacity', 0);

        // Create node groups
        const nodeGroups = this.g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(data.nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .call(this.drag());

        // Add node shapes
        nodeGroups.append('rect')
            .attr('class', d => `node-${d.type}`)
            .attr('width', d => this.getNodeWidth(d))
            .attr('height', d => this.getNodeHeight(d))
            .attr('x', d => -this.getNodeWidth(d) / 2)
            .attr('y', d => -this.getNodeHeight(d) / 2)
            .attr('rx', 8)
            .attr('fill', d => this.getNodeColor(d))
            .attr('stroke', d => this.getNodeStroke(d))
            .attr('stroke-width', 2)
            .style('opacity', 0);

        // Add node labels
        nodeGroups.append('text')
            .attr('class', 'node-text')
            .attr('dy', '0.35em')
            .style('opacity', 0)
            .text(d => this.getNodeLabel(d));

        // Store references
        this.nodes = nodeGroups;

        // Add event listeners
        this.addEventListeners();

        // Start simulation and animate
        this.simulation.on('tick', () => this.ticked());
        this.animateIn();
    }

    getNodeWidth(d) {
        if (d.type === 'table') {
            return Math.max(120, d.label.length * 8);
        }
        return Math.max(80, d.label.length * 6);
    }

    getNodeHeight(d) {
        return d.type === 'table' ? 50 : 30;
    }

    getNodeColor(d) {
        const colors = {
            bronze: '#ff6b35',
            silver: '#00d4ff',
            gold: '#00ff88',
            default: '#8b5cf6'
        };
        return colors[d.group] || colors.default;
    }

    getNodeStroke(d) {
        const strokes = {
            bronze: '#ff8c42',
            silver: '#33e0ff',
            gold: '#33ff99',
            default: '#a78bfa'
        };
        return strokes[d.group] || strokes.default;
    }

    getNodeLabel(d) {
        if (this.isColumnView) {
            return d.label;
        }
        return d.label.length > 20 ? d.label.substring(0, 20) + '...' : d.label;
    }

    addEventListeners() {
        this.nodes
            .on('mouseover', (event, d) => this.handleNodeHover(d, true))
            .on('mouseout', (event, d) => this.handleNodeHover(d, false))
            .on('click', (event, d) => this.handleNodeClick(d));
    }

    handleNodeHover(node, isHover) {
        if (isHover) {
            // Highlight connected nodes and links
            this.highlightConnections(node);
        } else {
            // Reset highlighting
            this.resetHighlight();
        }
    }

    handleNodeClick(node) {
        // Show metadata sidebar
        this.showMetadata(node);
    }

    highlightConnections(targetNode) {
        // Dim all elements first
        this.nodes.selectAll('rect').classed('dimmed', true);
        this.links.classed('dimmed', true);

        // Highlight target node
        this.nodes.filter(d => d.id === targetNode.id)
            .selectAll('rect')
            .classed('highlighted', true)
            .classed('dimmed', false);

        // Highlight connected links and nodes
        this.links.each((d, i, nodes) => {
            if (d.source.id === targetNode.id || d.target.id === targetNode.id) {
                d3.select(nodes[i])
                    .classed('highlighted', true)
                    .classed('dimmed', false);

                // Highlight connected nodes
                const connectedId = d.source.id === targetNode.id ? d.target.id : d.source.id;
                this.nodes.filter(node => node.id === connectedId)
                    .selectAll('rect')
                    .classed('highlighted', true)
                    .classed('dimmed', false);
            }
        });
    }

    resetHighlight() {
        this.nodes.selectAll('rect')
            .classed('highlighted', false)
            .classed('dimmed', false);
        
        this.links
            .classed('highlighted', false)
            .classed('dimmed', false);
    }

    showMetadata(node) {
        const sidebar = document.getElementById('metadata-sidebar');
        const title = document.getElementById('sidebar-title');
        const content = document.getElementById('sidebar-content');

        title.textContent = this.isColumnView ? 'Column Details' : 'Table Details';
        
        let html = `
            <div class="metadata-item">
                <label>Name:</label>
                <span>${node.label}</span>
            </div>
        `;

        if (node.type === 'table') {
            html += `
                <div class="metadata-item">
                    <label>Type:</label>
                    <span>Table</span>
                </div>
                <div class="metadata-item">
                    <label>Schema:</label>
                    <span>${node.group}</span>
                </div>
                <div class="metadata-item">
                    <label>Columns:</label>
                    <span>${node.columnCount}</span>
                </div>
            `;
        } else {
            html += `
                <div class="metadata-item">
                    <label>Type:</label>
                    <span>Column</span>
                </div>
                <div class="metadata-item">
                    <label>Table:</label>
                    <span>${node.tableName}</span>
                </div>
            `;
        }

        content.innerHTML = html;
        sidebar.classList.add('open');
    }

    ticked() {
        if (this.links) {
            this.links.attr('d', d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy) * 0.3;
                return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
            });
        }

        if (this.nodes) {
            this.nodes.attr('transform', d => `translate(${d.x},${d.y})`);
        }
    }

    animateIn() {
        // Animate nodes
        this.nodes.selectAll('rect')
            .transition()
            .duration(800)
            .delay((d, i) => i * 100)
            .style('opacity', 1)
            .attr('transform', 'scale(1)')
            .ease(d3.easeElasticOut);

        this.nodes.selectAll('text')
            .transition()
            .duration(600)
            .delay((d, i) => i * 100 + 200)
            .style('opacity', 1);

        // Animate links
        this.links
            .transition()
            .duration(1000)
            .delay((d, i) => i * 50 + 400)
            .style('opacity', 0.7)
            .ease(d3.easeQuadOut);
    }

    toggleView() {
        if (!this.currentData) return;
        
        this.isColumnView = !this.isColumnView;
        this.render(this.currentData, this.isColumnView);
    }

    resetZoom() {
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity);
    }

    drag() {
        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    resize() {
        this.updateDimensions();
        if (this.simulation) {
            this.simulation
                .force('center', d3.forceCenter(this.width / 2, this.height / 2))
                .restart();
        }
    }
}
