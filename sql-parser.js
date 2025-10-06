class SQLParser {
    constructor() {
        this.tables = new Map();
        this.relationships = [];
        this.columns = new Map();
    }

    parseQuery(sqlQuery) {
        // Clean and normalize the query
        const cleanQuery = this.cleanQuery(sqlQuery);
        
        // Reset state
        this.tables.clear();
        this.relationships = [];
        this.columns.clear();

        // Parse different parts of the query
        this.parseFromClause(cleanQuery);
        this.parseJoins(cleanQuery);
        this.parseSelectClause(cleanQuery);
        this.parseWithClause(cleanQuery);

        return {
            tables: Array.from(this.tables.values()),
            relationships: this.relationships,
            columns: Array.from(this.columns.values())
        };
    }

    cleanQuery(query) {
        return query
            .replace(/--.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    parseFromClause(query) {
        // Match FROM clause patterns
        const fromPattern = /FROM\s+([^WHERE|JOIN|GROUP|ORDER|HAVING|LIMIT|;]+)/gi;
        const matches = query.match(fromPattern);

        if (matches) {
            matches.forEach(match => {
                const tablesPart = match.replace(/FROM\s+/i, '').trim();
                this.extractTablesFromString(tablesPart);
            });
        }
    }

    parseJoins(query) {
        // Match various JOIN patterns
        const joinPattern = /((?:LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN)\s+([^\s]+)(?:\s+(?:AS\s+)?([^\s]+))?\s+ON\s+([^JOIN|WHERE|GROUP|ORDER|HAVING|LIMIT|;]+)/gi;
        let match;

        while ((match = joinPattern.exec(query)) !== null) {
            const [, joinType, tableName, alias, onCondition] = match;
            
            // Add the joined table
            this.addTable(tableName, alias);
            
            // Parse the ON condition to find relationships
            this.parseJoinCondition(onCondition);
        }
    }

    parseSelectClause(query) {
        // Extract SELECT clause
        const selectPattern = /SELECT\s+(.*?)\s+FROM/gi;
        const match = selectPattern.exec(query);

        if (match) {
            const selectClause = match[1];
            this.parseSelectColumns(selectClause);
        }
    }

    parseWithClause(query) {
        // Parse CTE (Common Table Expressions)
        const withPattern = /WITH\s+(.*?)\s+SELECT/gi;
        const match = withPattern.exec(query);

        if (match) {
            const withClause = match[1];
            this.parseCTEs(withClause);
        }
    }

    extractTablesFromString(tableString) {
        // Handle comma-separated tables and subqueries
        const parts = tableString.split(',');
        
        parts.forEach(part => {
            part = part.trim();
            
            // Skip subqueries for now (basic implementation)
            if (part.includes('(')) return;
            
            // Extract table name and alias
            const tableParts = part.split(/\s+/);
            const tableName = tableParts[0];
            const alias = tableParts.length > 1 && !['AS'].includes(tableParts[1].toUpperCase()) 
                ? tableParts[tableParts.length - 1] 
                : null;
            
            this.addTable(tableName, alias);
        });
    }

    parseSelectColumns(selectClause) {
        // Handle SELECT * case
        if (selectClause.trim() === '*') {
            return;
        }

        // Split by comma, but be careful with functions
        const columns = this.smartSplit(selectClause, ',');
        
        columns.forEach(col => {
            col = col.trim();
            
            // Skip aggregations and complex expressions for basic implementation
            if (col.includes('(') && !col.match(/^\w+\.\w+$/)) return;
            
            // Extract column references
            const columnMatch = col.match(/(\w+)\.(\w+)(?:\s+(?:AS\s+)?(\w+))?/i);
            if (columnMatch) {
                const [, tableRef, columnName, alias] = columnMatch;
                this.addColumn(tableRef, columnName, alias);
            }
        });
    }

    parseJoinCondition(condition) {
        // Extract table.column = table.column patterns
        const conditionPattern = /(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi;
        let match;

        while ((match = conditionPattern.exec(condition)) !== null) {
            const [, leftTable, leftColumn, rightTable, rightColumn] = match;
            
            this.addRelationship(
                leftTable, leftColumn,
                rightTable, rightColumn,
                'join'
            );
        }
    }

    parseCTEs(withClause) {
        // Basic CTE parsing - can be enhanced
        const ctePattern = /(\w+)\s+AS\s*\((.*?)\)/gi;
        let match;

        while ((match = ctePattern.exec(withClause)) !== null) {
            const [, cteName, cteQuery] = match;
            this.addTable(cteName, null, 'cte');
            
            // Recursively parse the CTE query
            const subParser = new SQLParser();
            const subResult = subParser.parseQuery(cteQuery);
            
            // Add relationships from CTE to its source tables
            subResult.tables.forEach(table => {
                this.addRelationship(table.name, '*', cteName, '*', 'cte');
            });
        }
    }

    addTable(name, alias = null, type = 'table') {
        const cleanName = name.replace(/[`"'\[\]]/g, '');
        const tableId = alias || cleanName;
        
        if (!this.tables.has(tableId)) {
            this.tables.set(tableId, {
                id: tableId,
                name: cleanName,
                alias: alias,
                type: type,
                columns: []
            });
        }
    }

    addColumn(tableRef, columnName, alias = null) {
        const columnId = `${tableRef}.${columnName}`;
        
        if (!this.columns.has(columnId)) {
            this.columns.set(columnId, {
                id: columnId,
                table: tableRef,
                name: columnName,
                alias: alias,
                type: 'column'
            });
        }

        // Add column to table if table exists
        if (this.tables.has(tableRef)) {
            const table = this.tables.get(tableRef);
            if (!table.columns.some(col => col.name === columnName)) {
                table.columns.push({
                    name: columnName,
                    alias: alias
                });
            }
        }
    }

    addRelationship(sourceTable, sourceColumn, targetTable, targetColumn, type = 'flow') {
        this.relationships.push({
            id: `${sourceTable}.${sourceColumn}->${targetTable}.${targetColumn}`,
            source: sourceTable,
            sourceColumn: sourceColumn,
            target: targetTable,
            targetColumn: targetColumn,
            type: type
        });
    }

    smartSplit(str, delimiter) {
        // Split by delimiter but respect parentheses
        const result = [];
        let current = '';
        let depth = 0;
        
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (char === delimiter && depth === 0) {
                result.push(current.trim());
                current = '';
                continue;
            }
            
            current += char;
        }
        
        if (current.trim()) {
            result.push(current.trim());
        }
        
        return result;
    }

    // Generate sample data for demonstration
    generateSampleData() {
        return {
            tables: [
                {
                    id: 'bronze_customers',
                    name: 'bronze.customers',
                    alias: null,
                    type: 'table',
                    columns: [
                        { name: 'customer_id', alias: null },
                        { name: 'email', alias: null },
                        { name: 'first_name', alias: null },
                        { name: 'last_name', alias: null },
                        { name: 'created_at', alias: null }
                    ]
                },
                {
                    id: 'bronze_orders',
                    name: 'bronze.orders',
                    alias: null,
                    type: 'table',
                    columns: [
                        { name: 'order_id', alias: null },
                        { name: 'customer_id', alias: null },
                        { name: 'order_date', alias: null },
                        { name: 'total_amount', alias: null },
                        { name: 'status', alias: null }
                    ]
                },
                {
                    id: 'silver_customer_orders',
                    name: 'silver.customer_orders',
                    alias: null,
                    type: 'table',
                    columns: [
                        { name: 'customer_id', alias: null },
                        { name: 'customer_name', alias: null },
                        { name: 'total_orders', alias: null },
                        { name: 'total_spent', alias: null },
                        { name: 'avg_order_value', alias: null }
                    ]
                },
                {
                    id: 'gold_customer_metrics',
                    name: 'gold.customer_metrics',
                    alias: null,
                    type: 'table',
                    columns: [
                        { name: 'customer_id', alias: null },
                        { name: 'customer_segment', alias: null },
                        { name: 'lifetime_value', alias: null },
                        { name: 'churn_risk', alias: null }
                    ]
                }
            ],
            relationships: [
                {
                    id: 'bronze_customers->silver_customer_orders',
                    source: 'bronze_customers',
                    sourceColumn: 'customer_id',
                    target: 'silver_customer_orders',
                    targetColumn: 'customer_id',
                    type: 'flow'
                },
                {
                    id: 'bronze_orders->silver_customer_orders',
                    source: 'bronze_orders',
                    sourceColumn: 'customer_id',
                    target: 'silver_customer_orders',
                    targetColumn: 'customer_id',
                    type: 'flow'
                },
                {
                    id: 'silver_customer_orders->gold_customer_metrics',
                    source: 'silver_customer_orders',
                    sourceColumn: 'customer_id',
                    target: 'gold_customer_metrics',
                    targetColumn: 'customer_id',
                    type: 'flow'
                }
            ],
            columns: []
        };
    }
}
