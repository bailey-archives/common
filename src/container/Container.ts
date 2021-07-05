import { ReflectionClass } from '../reflection/ReflectionClass';
import { Type } from '../types/types';

/**
 * A basic dependency injection container which creates and stores singletons.
 */
export class Container {

	private _singletons = new Map<Type<any>, any>();

	/**
	 * Retrieves an instance of the specified type with dependencies automatically injected based on types registered
	 * in this container. The instance is cached internally and reused as a singleton.
	 *
	 * Note: The target class must have decorators applied for its metadata to be emitted. Use the blank `@Resolvable()`
	 * decorator if needed.
	 *
	 * @param type
	 */
	public singleton<T>(type: Type<T>): T {
		// Return existing instance if possible
		if (this._singletons.has(type)) {
			return this._singletons.get(type)!;
		}

		const ref = new ReflectionClass(type);
		const paramTypes = ref.getMetadata<Type<any>[]>('design:paramtypes') ?? [];
		const params: any[] = [];

		for (const paramType of paramTypes) {
			params.push(this.singleton(paramType));
		}

		const instance = new type(...params);
		this._singletons.set(type, instance);

		return instance;
	}

	/**
	 * Makes a new instance of the given type. This method ignores the local singleton cache and will always
	 * construct a new object. The new object is not cached and cannot be retrieved again by the container.
	 *
	 * Note: The target class must have decorators applied for its metadata to be emitted. Use the blank `@Resolvable()`
	 * decorator if needed.
	 *
	 * @param type
	 * @returns
	 */
	public make<T>(type: Type<T>): T {
		const ref = new ReflectionClass(type);
		const paramTypes = ref.getMetadata<Type<any>[]>('design:paramtypes') ?? [];
		const params: any[] = [];

		for (const paramType of paramTypes) {
			params.push(this.singleton(paramType));
		}

		const instance = new type(...params);

		return instance;
	}

	/**
	 * Registers the given object as a singleton instance in the container, making it available as a dependency for
	 * classes that need it.
	 *
	 * @param object
	 */
	public register(object: Object) {
		this._singletons.set(object.constructor as Type<any>, object);
	}

	/**
	 * Clears all singletons from the container.
	 */
	public clear(): void;

	/**
	 * Clears the singleton for the given type from the container.
	 *
	 * @param type
	 */
	public clear(type: Type<any>): void;
	public clear(type?: Type<any>) {
		if (type !== undefined) {
			this._singletons.delete(type);
		}
		else {
			this._singletons.clear();
		}
	}

}
