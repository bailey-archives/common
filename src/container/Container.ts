import { ReflectionClass } from '../reflection/ReflectionClass';
import { Type } from '../types/types';
import { ContainerDispatcher } from './ContainerDispatcher';
import { registry } from './ContainerRegistry';
import { resolver } from './ContainerResolver';

/**
 * A basic dependency injection container which creates and stores singletons.
 */
export class Container {

	protected _providers = new Map<InjectionToken, Registration[]>();
	protected _scopedInstances = new Map<Registration, any>();
	protected _context = new Map<string, any>();

	public constructor(protected parent?: Container) {

	}

	/**
	 * Registers an existing instance value for the specified token.
	 *
	 * @param token
	 * @param provider
	 */
	public register<T>(token: InjectionToken<T>, provider: ValueProvider<T>): this;

	/**
	 * Registers a factory provider for the specified token. The factory is a function which will be invoked when
	 * the token is resolved, and should return an instance for the token.
	 *
	 * @param token
	 * @param provider
	 */
	public register<T>(token: InjectionToken<T>, provider: FactoryProvider<T>): this;

	/**
	 * Registers a token to resolve to another token in the same container. This is effectively an alias or redirect.
	 *
	 * @param token
	 * @param provider
	 * @param options
	 */
	public register<T>(token: InjectionToken<T>, provider: TokenProvider<T>, options?: RegistrationOptions): this;

	/**
	 * Registers a class type for the specified token. The container will automatically instantiate the type when
	 * the token is resolved.
	 *
	 * @param token
	 * @param provider
	 * @param options
	 */
	public register<T>(token: InjectionToken<T>, provider: ClassProvider<T>, options?: RegistrationOptions): this;

	/**
	 * Registers a class type for the specified token. The container will automatically instantiate the type when
	 * the token is resolved.
	 *
	 * @param token
	 * @param type
	 * @param options
	 */
	public register<T>(token: InjectionToken<T>, type: Type<T>, options?: RegistrationOptions): this;

	/**
	 * Registers a class type. The type will also be used for the token. The container will automatically instantiate
	 * the type when the token is resolved.
	 *
	 * @param type
	 * @param options
	 */
	public register<T>(type: Type<T>, options?: RegistrationOptions): this;

	public register<T>(a: InjectionToken<T>, b?: Provider | Type<T> | RegistrationOptions, c?: RegistrationOptions) {
		const token = a;
		const providerOrType = isProvider(b) || isConstructor(b) ? b : a as Type<T>;
		const options = typeof b === 'object' && !isProvider(b) ? b : c;

		if (!this._providers.has(token)) {
			this._providers.set(token, []);
		}

		if (isProvider(providerOrType)) {
			this._providers.get(token)?.push({
				provider: providerOrType,
				options
			});
		}

		else {
			this._providers.get(token)?.push({
				provider: { useClass: providerOrType },
				options
			});
		}

		return this;
	}

	/**
	 * Registers an existing instance for the specified token.
	 *
	 * @param token
	 * @param instance
	 * @returns
	 */
	public registerInstance<T>(token: InjectionToken<T>, instance: T) {
		return this.register(token, {
			useValue: instance
		});
	}

	/**
	 * Registers a singleton for the specified `from` token which will be resolved to the given `to` token.
	 *
	 * @param from
	 * @param to
	 */
	public registerSingleton<T>(from: InjectionToken<T>, to: InjectionToken<T>): this;
	public registerSingleton<T>(from: Type<T>, to?: Type<any>): this;
	public registerSingleton<T>(from: InjectionToken<T>, to?: InjectionToken<T>) {
		if (isNormalToken(from)) {
			if (isNormalToken(to)) {
				return this.register(from, { useToken: to }, { lifecycle: Lifecycle.Singleton });
			}
			else if (to) {
				return this.register(from, { useClass: to }, { lifecycle: Lifecycle.Singleton });
			}

			throw new Error('A to token must be provided when the from token is a type name');
		}

		return this.register(
			from,
			to && !isNormalToken(to) ? to : from,
			{ lifecycle: Lifecycle.Singleton }
		);
	}

	/**
	 * Resolves a single instance for the specified token.
	 *
	 * Note that if the container is able to produce multiple instances for the token, the last instance that was
	 * registered will be resolved.
	 *
	 * @param token
	 * @returns
	 */
	public resolve<T>(token: InjectionToken<T>): T {
		const registration = this.getRegistration(token, 'single');

		// Return an instance if available
		if (registration !== undefined) {
			return this.make(registration);
		}

		// We don't have a registration for this token
		// If it's a string or symbol, we can't create it from the token itself, so throw an error
		if (isNormalToken(token)) {
			throw new Error(`Cannot resolve unregistered token "${token.toString()}"`);
		}

		// If it's a constructor we can create a transient instance
		if (isConstructorToken(token)) {
			return this.construct(token);
		}

		// Could not resolve
		if (typeof token === 'undefined') {
			throw new Error(`Failed to resolve undefined token, this could be a circular dependency issue`);
		}
		else {
			throw new Error(`Failed to resolve ${typeof token} token`);
		}
	}

	/**
	 * Resolves all instances for the specified token.
	 *
	 * @param token
	 * @returns
	 */
	public resolveAll<T>(token: InjectionToken<T>): T[] {
		const registrations = this.getRegistration(token, 'all');
		const instances = new Array<T>();

		for (const registration of registrations) {
			instances.push(this.make(registration));
		}

		return instances;
	}

	/**
	 * Makes and returns an instance for the given registration. Uses an existing instance if available, according to
	 * the registration lifecycle.
	 *
	 * @param registration
	 * @returns
	 */
	protected make<T>(registration: Registration<T>): T {
		const lifecycle = registration.options?.lifecycle ?? Lifecycle.Transient;

		switch (lifecycle) {
			case Lifecycle.Transient: {
				return this.makeInstance(registration.provider);
			};

			case Lifecycle.Singleton: {
				if (registration.instance === undefined) {
					registration.instance = this.makeInstance(registration.provider);
				}

				return registration.instance;
			};

			case Lifecycle.ContainerScoped: {
				if (!this._scopedInstances.has(registration)) {
					this._scopedInstances.set(registration, this.makeInstance(registration.provider));
				}

				return this._scopedInstances.get(registration)!;
			}
		}
	}

	/**
	 * Makes and returns an instance for the given provider. Does not cache or reuse existing instances, use the
	 * `make` method for that instead.
	 *
	 * @param provider
	 * @returns
	 */
	protected makeInstance<T>(provider: Provider<T>): T {
		if (isClassProvider(provider)) {
			return this.construct(provider.useClass);
		}

		if (isFactoryProvider(provider)) {
			return provider.useFactory(this);
		}

		if (isTokenProvider(provider)) {
			return this.resolve(provider.useToken);
		}

		if (isValueProvider(provider)) {
			return provider.useValue;
		}

		throw new Error('Failed to make an instance');
	}

	/**
	 * Constructs an instance of the given type with dependency injection.
	 *
	 * @param type
	 * @returns
	 */
	protected construct<T>(type: Type<T>): T {
		const paramTypes = registry.getConstructorParameters(type);

		if (paramTypes === undefined) {
			throw new Error(
				`The container couldn't construct an instance of ${type.name} because no type information is known. ` +
				'Have you added the `@Injectable` decorator to the class?'
			);
		}

		const params = paramTypes.map(param => this.resolve(param));

		resolver._addConstructorInstance(this);
		const instance = new type(...params);
		resolver._removeConstructorInstance();

		return instance;
	}

	/**
	 * Returns the latest registration for the given token in the current container. Falls back to the latest
	 * registration in the parent container, and then its parent, and so forth. Returns `undefined` if not found.
	 *
	 * @param token
	 * @param type
	 */
	protected getRegistration<T>(token: InjectionToken<T>, type: 'single'): Registration<T> | undefined;

	/**
	 * Returns an array of all registrations for the given token in the current container and its parents.
	 *
	 * The registrations will be ordered by container level (the first index is the top most container) as well as the
	 * order of registration within each container. The last element in the array will be the the highest priority
	 * registration.
	 *
	 * @param token
	 * @param type
	 */
	protected getRegistration<T>(token: InjectionToken<T>, type: 'all'): Registration<T>[];
	protected getRegistration<T>(token: InjectionToken<T>, type: 'single' | 'all') {
		if (type === 'all') {
			const registrations = [];

			if (this.parent !== undefined) {
				registrations.unshift(...this.parent.getRegistration(token, 'all'));
			}

			registrations.push(...(this._providers.get(token) ?? []));

			return registrations;
		}

		else if (type === 'single') {
			const registrations = this._providers.get(token) ?? [];

			if (registrations.length === 0 && this.parent !== undefined) {
				return this.parent.getRegistration(token, 'single');
			}

			return registrations[registrations.length - 1];
		}

		throw new Error(`Unknown registration type "${type}"`);
	}

	/**
	 * Returns true if the specified token is registered in this container. If `recursive` is set to true, checks
	 * parent container(s) as well.
	 *
	 * @param token
	 * @param recursive
	 * @returns
	 */
	public isRegistered<T>(token: InjectionToken<T>, recursive = false): boolean {
		return this._providers.has(token) ||
			(recursive && (this.parent || false) && this.parent.isRegistered(token, true));
	}

	/**
	 * Resets and clears the container of all registered tokens, providers, and context variables.
	 */
	public reset() {
		this._providers.clear();
		this._context.clear();
		this._scopedInstances.clear();
	}

	/**
	 * Clears all cached instances from the container, but keeps the tokens intact so that new instances may be
	 * generated for their next resolutions.
	 */
	public clearInstances() {
		for (const providers of this._providers.values()) {
			for (const provider of providers) {
				provider.instance = undefined;
			}
		}

		this._scopedInstances.clear();
	}

	/**
	 * Sets the value of a context variable in the container.
	 *
	 * Context allows you to use a container for basic state storage that can be easily accessed by users of the
	 * container and factory providers.
	 *
	 * @param name
	 * @param value
	 */
	public setContext<T = any>(name: string, value: T) {
		this._context.set(name, value);
	}

	/**
	 * Returns the value of the specified context variable in the container. If the variable is not set, returns the
	 * value of the `defaultsTo` parameter, or `undefined`.
	 *
	 * @param name
	 * @param defaultsTo
	 */
	public getContext<T = any>(name: string, defaultsTo: T): T;
	public getContext<T = any>(name: string): T | undefined;
	public getContext<T = any>(name: string, defaultsTo?: T): T | undefined {
		if (this._context.has(name)) {
			return this._context.get(name);
		}

		return defaultsTo;
	}

	/**
	 * Deletes the specified context variable from the container if it exists.
	 *
	 * @param name
	 */
	public removeContext(name: string) {
		this._context.delete(name);
	}

	/**
	 * Creates a new child container.
	 *
	 * @returns
	 */
	public createChildContainer(): Container {
		return new Container(this);
	}

	/**
	 * Creates a new dispatcher, which helps invoke class methods with dependency injection.
	 */
	public createDispatcher() {
		return new ContainerDispatcher(this);
	}

}

export type InjectionToken<T = any> = Type<T> | string | symbol;
export type Provider<T = any> = ValueProvider<T> | ClassProvider<T> | TokenProvider<T> | FactoryProvider<T>;

export interface ValueProvider<T> {
	useValue: T;
}

export interface ClassProvider<T> {
	useClass: Type<T>;
}

export interface TokenProvider<T> {
	useToken: InjectionToken<T>;
}

export interface FactoryProvider<T> {
	useFactory: (container: Container) => T;
}

export interface RegistrationOptions {
	lifecycle: Lifecycle;
}

export enum Lifecycle {
	/**
	 * A new instance will be created for each resolve. This is the default scope.
	 */
	Transient,

	/**
	 * Each resolve will return the same instance (including in child containers).
	 */
	Singleton,

	/**
	 * Each resolve will return the same instance per container, i.e. child containers will return their own
	 * unique singleton instance.
	 */
	ContainerScoped
}

function isValueProvider(provider: any): provider is ValueProvider<any> {
	return !!(provider as ValueProvider<any>).useValue;
}

function isClassProvider(provider: any): provider is ClassProvider<any> {
	return !!(provider as ClassProvider<any>).useClass;
}

function isTokenProvider(provider: any): provider is TokenProvider<any> {
	return !!(provider as TokenProvider<any>).useToken;
}

function isFactoryProvider(provider: any): provider is FactoryProvider<any> {
	return !!(provider as FactoryProvider<any>).useFactory;
}

function isProvider(provider: any): provider is Provider {
	return provider !== undefined && (
		isValueProvider(provider) ||
		isClassProvider(provider) ||
		isTokenProvider(provider) ||
		isFactoryProvider(provider));
}

function isNormalToken(token?: InjectionToken): token is string | symbol {
	return typeof token === 'string' || typeof token === 'symbol';
}

function isConstructorToken<T>(token?: InjectionToken<T>): token is Type<T> {
	return typeof token === 'function';
}

function isConstructor<T>(o: any): o is Type<T> {
	return typeof o === 'function';
}

interface Registration<T = any> {
	provider: Provider<T>;
	options?: RegistrationOptions;
	instance?: any;
}
