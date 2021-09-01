/**
 * Data structure that implements a dependency graph.
 */
export class DependencyGraph<T = any> {

	protected _nodes = new Set<T>();
	protected _outgoingEdges = new Map<T, Set<T>>();
	protected _incomingEdges = new Map<T, Set<T>>();

	/**
	 * Whether or not circular dependencies are allowed. Defaults to `false` in which case errors will be thrown
	 * upon their detection.
	 */
	public allowCircularDependencies = false;

	/**
	 * The number of nodes in the graph.
	 */
	public get size() {
		return this._nodes.size;
	}

	/**
	 * Adds a node to the dependency graph.
	 *
	 * @param node
	 */
	public addNode(node: T) {
		if (!this._nodes.has(node)) {
			this._nodes.add(node);
			this._outgoingEdges.set(node, new Set());
			this._incomingEdges.set(node, new Set());
		}
	}

	/**
	 * Removes a node from the dependency graph.
	 *
	 * @param node
	 */
	public removeNode(node: T) {
		this._nodes.delete(node);
		this._outgoingEdges.delete(node);
		this._incomingEdges.delete(node);

		for (const set of [...this._incomingEdges.values(), ...this._outgoingEdges.values()]) {
			set.delete(node);
		}
	}

	/**
	 * Returns true if the specified node exists in the graph.
	 *
	 * @param node
	 * @returns
	 */
	public hasNode(node: T) {
		return this._nodes.has(node);
	}

	/**
	 * Adds a dependency between two nodes. The given `from` node will become dependent on the `to` node.
	 *
	 * Both nodes must already exist in the graph or an error will be thrown.
	 *
	 * @param from
	 * @param to
	 */
	public addDependency(from: T, to: T) {
		if (!this.hasNode(from)) {
			throw new Error('Node "from" does not exist');
		}

		if (!this.hasNode(to)) {
			throw new Error('Node "to" does not exist');
		}

		this._outgoingEdges.get(from)?.add(to);
		this._incomingEdges.get(to)?.add(from);

		return true;
	}

	/**
	 * Removes a dependency between two nodes. The given `from` node will no longer be dependent upon the `to` node.
	 *
	 * @param from
	 * @param to
	 */
	public removeDependency(from: T, to: T) {
		if (this.hasNode(from)) {
			this._outgoingEdges.get(from)?.delete(to);
		}

		if (this.hasNode(to)) {
			this._incomingEdges.get(to)?.delete(from);
		}
	}

	/**
	 * Returns an array containing all direct dependencies of the given node.
	 *
	 * @param node
	 */
	public getDirectDependenciesOf(node: T) {
		if (this.hasNode(node)) {
			return [...this._outgoingEdges.get(node)!];
		}

		throw new Error('Node does not exist');
	}

	/**
	 * Returns an array containing the nodes that directly depend on the given node.
	 *
	 * @param node
	 */
	public getDirectDependentsOf(node: T) {
		if (this.hasNode(node)) {
			return [...this._incomingEdges.get(node)!];
		}

		throw new Error('Node does not exist');
	}

	/**
	 * Returns an array containing the nodes that the specified node depends on (transitively).
	 *
	 * Throws an error if circular dependencies are detected or if the node does not exist.
	 *
	 * @param node
	 * @param filterLeaves When true, only nodes that do not depend on any other nodes will be returned.
	 * @returns
	 */
	public getDependenciesOf(node: T, filterLeaves = false) {
		if (this.hasNode(node)) {
			const result = new Set<T>();
			const dfs = createDFS(this._outgoingEdges, filterLeaves, this.allowCircularDependencies, result);

			// Run DFS on the edges
			dfs(node);

			// Remove the target node from the results
			result.delete(node);

			return [...result];
		}

		throw new Error('Node does not exist');
	}

	/**
	 * Returns an array containing the nodes that depend on the specified node (transitively).
	 *
	 * Throws an error if circular dependencies are detected or if the node does not exist.
	 *
	 * @param node
	 * @param filterLeaves When true, only nodes that do not have any dependents will be returned.
	 * @returns
	 */
	public getDependentsOf(node: T, filterLeaves = false) {
		if (this.hasNode(node)) {
			const result = new Set<T>();
			const dfs = createDFS(this._incomingEdges, filterLeaves, this.allowCircularDependencies, result);

			// Run DFS on the edges
			dfs(node);

			// Remove the target node from the results
			result.delete(node);

			return [...result];
		}

		throw new Error('Node does not exist');
	}

	/**
	 * Computes the overall processing order for the dependency graph. Throws an error if circular dependencies are
	 * detected.
	 *
	 * @param filterLeaves When true, only nodes that do not depend on any other nodes will be returned.
	 */
	public getOverallOrder(filterLeaves = false) {
		const result = new Set<T>();
		const keys = [...this._nodes.keys()];

		if (this._nodes.size === 0) {
			return [];
		}

		// Look for cycles - we run the DFS starting at all the nodes in case there are several disconnected
		// subgraphs inside this graph
		if (!this.allowCircularDependencies) {
			const dfs = createDFS(this._outgoingEdges, false, this.allowCircularDependencies, new Set());
			for (const node of keys) {
				dfs(node);
			}
		}

		// Create the main DFS
		const dfs = createDFS(this._outgoingEdges, filterLeaves, this.allowCircularDependencies, result);

		// Find all potential starting points (nodes with nothing depending on them) and run a DFS starting at those
		// points to get the overall order
		keys
			.filter(node => this._incomingEdges.get(node)!.size === 0)
			.forEach(dfs);

		// If we're allowing circular deps - we need to run the DFS against any remaining nodes that did not end up in
		// the initial result (as they are part of a subgraph that does not have a clear starting point)
		if (this.allowCircularDependencies) {
			keys
				.filter(node => !result.has(node))
				.forEach(dfs);
		}

		return [...result];
	}

	/**
	 * Returns an array of nodes that have no dependents.
	 */
	public getEntryNodes() {
		return [...this._nodes.keys()].filter(node => this._incomingEdges.get(node)!.size === 0);
	}

}

/**
 * Error thrown from the `DependencyGraph` when a circular dependency is detected. This error will contain the path
 * to the circular dependency as well as the node it failed on.
 */
export class CircularDependencyError<T = any> extends Error {
	public node: T;

	public constructor(public path: T[]) {
		super();

		const link = path.map(node => ('' + node)).join(' -> ');

		this.node = path[path.length - 1];
		this.name = 'CircularDependencyError';
		this.message = `Detected circular dependencies (${link})`;
	}
}

/**
 * Helper for creating a topological sort using depth-first-search on a set of edges.
 *
 * Detects cycles and throws an error if one is detected (unless the `allowCircularDeps` parameter is true in which
 * case it ignores them).
 *
 * @param edges The set of edges to DFS through
 * @param filterLeaves Whether to only return "leaf" nodes (ones who have no edges)
 * @param allowCircularDeps A boolean to allow circular dependencies instead of erroring
 * @param result An array in which the results will be populated
 */
function createDFS<T>(edges: Map<T, Set<T>>, filterLeaves: boolean, allowCircularDeps: boolean, result: Set<T>) {
	const visited = new Set<T>();

	return function (start: T) {
		if (visited.has(start)) {
			return;
		}

		const inCurrentPath = new Set<T>();
		const currentPath = new Array<T>();
		const todo = new Array<DfsTodoItem<T>>();

		todo.push({
			node: start,
			processed: false
		});

		while (todo.length > 0) {
			const current = todo[todo.length - 1];
			const { node, processed } = current;

			if (!processed) {
				if (visited.has(node)) {
					todo.pop();
					continue;
				}
				else if (inCurrentPath.has(node)) {
					// It's not a DAG
					if (allowCircularDeps) {
						todo.pop();
						continue;
					}

					currentPath.push(node);
					throw new CircularDependencyError(currentPath);
				}

				inCurrentPath.add(node);
				currentPath.push(node);

				// Push edges onto the todo stack in reverse order
				const nodeEdges = [...edges.get(node)!];
				for (let i = nodeEdges.length - 1; i >= 0; i--) {
					todo.push({
						node: nodeEdges[i],
						processed: false
					});
				}

				current.processed = true;
			}
			else {
				// Have visited edges (stack unrolling phase)
				todo.pop();
				currentPath.pop();
				inCurrentPath.delete(node);
				visited.add(node);

				if (!filterLeaves || edges.get(node)!.size === 0) {
					result.add(node);
				}
			}
		}
	}
}

interface DfsTodoItem<T> {
	node: T;
	processed: boolean;
}
