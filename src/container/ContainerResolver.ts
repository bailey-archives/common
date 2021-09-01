import { Container, container } from './Container';

/**
 * This class provides methods to retrieve container instances.
 */
class ContainerInstanceResolver {

	private _constructorInstances = new Array<Container>();
	private _namedInstances = new Map<string, Container>();

	/**
	 * Returns the global container instance.
	 */
	public getGlobalInstance(): Container {
		return container;
	}

	/**
	 * Returns the current container instance used for object construction. Throws an error if not available.
	 *
	 * This is useful for class constructors to retrieve an instance to the container that invoked them without
	 * injecting the container as a parameter.
	 */
	public getConstructorInstance(): Container {
		if (this._constructorInstances.length === 0) {
			throw new Error('No constructor container instance was found');
		}

		return this._constructorInstances[this._constructorInstances.length - 1];
	}

	/**
	 * Retrieves a container instance by its name, and creates it if not found.
	 *
	 * @param name
	 */
	public getInstance(name: string): Container {
		if (!this._namedInstances.has(name)) {
			this._namedInstances.set(name, new Container());
		}

		return this._namedInstances.get(name)!;
	}

	/**
	 * Adds a constructor instance to the end of the stack.
	 *
	 * @param instance
	 * @internal
	 */
	public _addConstructorInstance(instance: Container) {
		this._constructorInstances.push(instance);
	}

	/**
	 * Deletes the last constructor instance from the stack.
	 *
	 * @internal
	 */
	public _removeConstructorInstance() {
		this._constructorInstances.pop();
	}

}

/**
 * This helper provides methods to retrieve container instances.
 */
export const resolver = new ContainerInstanceResolver();
