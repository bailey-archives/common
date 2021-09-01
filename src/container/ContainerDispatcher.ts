import { ReflectionClass } from '../reflection/ReflectionClass';
import { Action, Key, Type } from '../types/types';
import { Container } from './Container';
import { registry } from './ContainerRegistry';

/**
 * This class is used to provide dependency injection for class methods which have the `@Injectable` decorator applied.
 *
 * You should not create an instance of this class directly. Instead, use the `container.createDispatcher()` method to
 * spawn a new instance.
 */
export class ContainerDispatcher {

	protected namedParameters = new Map<string, any>();
	protected typedParameters = new Map<Type<any>, any>();

	/**
	 * Constructs a new `ContainerDispatcher` instance.
	 *
	 * @param container The container that this dispatcher was created from.
	 */
	public constructor(public container: Container) {

	}

	/**
	 * Sets a named parameter for this dispatcher.
	 *
	 * When this dispatcher is used to resolve parameters for a method, if there is a parameter with the same name
	 * that could not be resolved by its type, it will instead be provided the given value.
	 *
	 * @param paramName
	 * @param value
	 */
	public setNamedParameter(paramName: string, value: any) {
		this.namedParameters.set(paramName, value);
	}

	/**
	 * Sets a typed parameter for this dispatcher.
	 *
	 * When this dispatcher is used to resolve parameters for a method, any parameters which match the given type
	 * will use the given instance instead. This effectively overrides the container.
	 *
	 * @param type
	 * @param instance
	 */
	public setTypedParameter<T>(type: Type<T>, instance: T) {
		this.typedParameters.set(type, instance);
	}

	/**
	 * Resolves and returns the parameters for the given method.
	 *
	 * Generally, you will not call this method yourself and instead you will use the `invoke()` method which calls
	 * and uses this method's return value automatically. But it's public just in case you need it. :)
	 *
	 * @param type
	 * @param methodName
	 */
	public resolveParameters<T>(type: Type<T>, methodName: Key<T>): any[];
	public resolveParameters<T>(object: T, methodName: Key<T>): any[];
	public resolveParameters<T>(objectOrType: Type<T> | T, methodName: string): any[] {
		const type = new ReflectionClass(objectOrType).type;
		const parameters = registry.getMethodParameters(type, methodName);
		const resolved = new Array<any>();

		if (parameters === undefined) {
			throw new Error(
				`The dispatcher couldn't resolve parameters for ${type.name}.${methodName} because no type information is known. ` +
				'Have you added the `@Injectable` decorator to the method?'
			);
		}

		for (const parameter of parameters) {
			const paramType = parameter.type as Type<any>;

			if (this.typedParameters.has(paramType)) {
				resolved.push(this.typedParameters.get(paramType));
			}
			else if (this.container.isRegistered(paramType, true) || !this.namedParameters.has(parameter.name)) {
				if (isPrimitive(paramType)) {
					throw new Error(
						`The dispatcher couldn't resolve a value for the "${parameter.name}" primitive parameter ` +
						`on ${type.name}.${methodName}. ` +
						`This parameter requires a named value but no matching name was found in the dispatcher.`
					);
				}

				resolved.push(this.container.resolve(paramType));
			}
			else {
				resolved.push(this.namedParameters.get(parameter.name));
			}
		}

		return resolved;
	}

	/**
	 * Invokes the specified method on the given object instance. The paremeters of the method will be resolved
	 * automatically using the parent container and the dispatcher's custom parameters.
	 *
	 * @param object
	 * @param methodName
	 */
	public invoke<T extends {}, K extends keyof T, R = Return<T, K>>(object: T, methodName: K): R {
		const params = this.resolveParameters(object, methodName as any);
		const fn: Action<R> = (object as any)[methodName];
		return fn.apply(object, params);
	}

}

function isPrimitive(type?: Function) {
	switch (type) {
		case String: return true;
		case Number: return true;
		case Object: return true;
		case Boolean: return true;
		case Function: return true;
	}

	return false;
}

type Return<T, K extends keyof T> = T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : void;
