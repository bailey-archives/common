# Common

This package contains several small classes, utilities, types, and polyfills that I use across most of my projects.

```
npm install @baileyherbert/common
```

---

- [Dependency Injection](#dependency-injection)
	- [`Container`](#container)
		- [Global container](#global-container)
		- [Registration](#registration)
		- [Decorators](#decorators)
		- [Resolution](#resolution)
		- [Child containers](#child-containers)
		- [Dispatchers](#dispatchers)
		- [Context](#context)
	- [`resolver`](#resolver)
		- [Named containers](#named-containers)
		- [Container references](#container-references)
- [Events](#events)
	- [`EventEmitter`](#eventemitter)
- [Logging](#logging)
	- [`Logger`](#logger)
	- [`LogConsoleWriter`](#logconsolewriter)
	- [`LogFileWriter`](#logfilewriter)
- [Polyfills](#polyfills)
	- [`Buffer`](#buffer)
- [Promises](#promises)
	- [`PromiseCompletionSource`](#promisecompletionsource)
	- [`PromiseTimeoutSource`](#promisetimeoutsource)
- [Reflection](#reflection)
	- [`ReflectionClass`](#reflectionclass)
	- [`ReflectionMethod`](#reflectionmethod)
- [Native](#native)
	- [`Command`](#command)
- [Decorators](#decorators-1)
	- [`@Reflectable`](#reflectable)
- [Types](#types)
	- [`Json`](#json)
	- [`Key<T>`](#keyt)
	- [`Value<T, K, F>`](#valuet-k-f)
	- [`Fallback<T, F>`](#fallbackt-f)
	- [`Promisable<T>`](#promisablet)
	- [`Type<T>`](#typet)
	- [`Action<T>`](#actiont)
- [Data structures](#data-structures)
	- [`DependencyGraph`](#dependencygraph)

---

## Dependency Injection

### `Container`

This is a dependency injection container that supports transient, singleton, and container-scoped instance resolution.
It allows you to spawn child containers, as well as dispatchers for method invocation with DI.

#### Global container

Import the global container from anywhere:

```ts
import { container } from '@baileyherbert/common';
```

#### Registration

Then register your types using injection tokens using the register methods.

```ts
container.register(ClassType);
container.register(ClassType, { useClass: ClassType });
container.register(ClassType, { useValue: new ClassType() });
container.register(ClassType, { useFactory: () => new ClassType() });

container.registerSingleton(ClassType);
container.registerSingleton(ClassType, ClassType);

container.registerInstance(ClassType, new ClassType());
```

When registering a class or token provider, or a type, you can provide a lifecycle:

```ts
container.register(ClassType, { lifecycle: Lifecycle.Singleton });
container.register(ClassType, { useClass: ClassType }, { lifecycle: Lifecycle.ContainerScoped });
```

- `Transient` creates a new instance for each resolution. This is the default.
- `Singleton` creates a single instance and caches it for subsequent resolutions.
- `ContainerScoped` creates a single instance per container (i.e. child containers will get their own).

#### Decorators

For the container to successfully resolve dependencies, all classes added to it must have the `@Injectable` decorator
applied.

```ts
@Injectable()
export class ClassType {}
```

You can also register a class as a singleton on the global container using the `@Singleton` decorator. This will
also mark the class as injectable so there's no need to add the `@Injectable` decorator.

```ts
@Singleton()
export class ClassType {}
```

You can also enable dependency injection on a **class method** by applying the `@Injectable` decorator to it.

```ts
@Singleton()
export class ClassType {
	@Injectable()
	public methodWithDI() {

	}
}
```

#### Resolution

To resolve a single instance, use the `resolve` method. The last provider to be registered will be used.

```ts
const instance = container.resolve(ClassType);
```

If multiple providers are registered, you can retrieve all of their instances as an array with the `resolveAll` method.

```ts
const instances = container.resolveAll(ClassType);
```

#### Child containers

You can create child containers on demand. By registering a dependency on a child container, you can override the
return value of the `resolve` method. The `resolveAll` method will return an array of dependencies from both containers
in the order of registration, and with the child container's dependencies last.

```ts
const child = container.createChildContainer();
child.registerInstance(ClassType, new ClassType());
```

#### Dispatchers

To invoke methods with dependency injection, first create a dispatcher.

```ts
const dispatcher = container.createDispatcher();
```

You can add custom typed instances which override the container. You can also add named values. If the method
has a parameter which fails to resolve with the container or has a primitive type, but has a matching named value, then
the named value will be used.

```ts
dispatcher.setNamedParameter('name', 'John Doe');
dispatcher.setTypedParameter(ClassType, new ClassType());
```

Finally, use the `invoke` method to resolve dependencies, execute, and get the return value.

```ts
const returnValue = dispatcher.invoke(object, 'methodName');
```

#### Context

Containers can store basic state information which is available to all of its users.

```ts
container.setContext('service', 'ServiceName');
container.setContext('id', 123);
```

Other parts of the application can retrieve the context.

```ts
const id = container.getContext<number>('id');
const service = container.getContext<string>('ServiceName');
```

### `resolver`

This helper manages global container instances and makes it easy for various parts of the application to retrieve a
reference to specific containers.

#### Named containers

If the global container is not sufficient, you can use named containers. Simply request a named container and it will
be created and cached globally.

```ts
import { resolver } from '@baileyherbert/common';

const container = resolver.getInstance('name');
```

#### Container references

If your application is using multiple containers, you might be interested in storing a reference to the container used
to construct an object. Generally, this would require injecting the container as a parameter.

The resolver instead makes the container available with the `getConstructorInstance()` method, but note that this
method will throw an error if not called from within a constructor that has been invoked by the container during DI.

Here's a reliable pattern for storing the container that works even if the class is extended:

```ts
import { resolver } from '@baileyherbert/common';

export class DependencyInjectedClass {
	protected container = resolver.getConstructorInstance();

	public constructor() {
		// Now all methods, including the constructor, has a reference to the container
		this.container.resolve();
	}
}
```

With a reference to the container, you could make it easier for nested components in your application to retrieve
top level objects, like a root `App` object.

```ts
export class DependencyInjectedClass {
	protected container = resolver.getConstructorInstance();
	protected app = this.container.resolve(App);
}
```

---

## Events

### `EventEmitter`

This is an alternative event emitter that works on all platforms. It allows you to specify the event types, and keeps
the `_emit` method protected.

```ts
import { EventEmitter } from '@baileyherbert/common';

export class Chat extends EventEmitter<Events> {

	protected _onUserConnected(user: User) {
		this._emit('connected', user.username);
	}

}

type Events = {
	chat: [username: string, message: string];
	connected: [username: string];
	disconnected: [username: string];
};
```

```ts
const chat = new Chat();

chat.on('connected', username => {
	console.log('User %s connected.', username);
});
```

---

## Logging

### `Logger`

This class creates a logger for a named service or component. It accepts the same arguments as `console.log()`, and
formats data the same way. Instead of sending output to `stdout`, this class emits log output via the `log` event.

```ts
import { Logger } from '@baileyherbert/common';

const logger = new Logger('app');

logger.on('log', event => {
	console.log(event.output);
});

logger.info('Hello world!');
logger.verbose('It works!');
```

Loggers can also spawn children for subcomponents. Their log output is forwarded back up to the root logger, so only
a single listener is required.

```ts
const child = logger.createLogger('child');
child.info('This is from a child logger!');
```

### `LogConsoleWriter`

This class can be used to print logger output to the console with colors, timestamps, and service names.

```ts
import { Logger, LogConsoleWriter, LogLevel } from '@baileyherbert/common';

// Create the logger
const logger = new Logger();

// Create the log console writer with verbosity set to 0 (verbose)
const writer = new LogConsoleWriter(LogLevel.Verbose);

// Mount the logger to the writer
// This immediately starts printing output to the console
writer.mount(logger);
```

### `LogFileWriter`

This class can be used to forward logger output to a file. It can also rotate the log file automatically after it
reaches a certain size. The default options are shown below.

```ts
import { LogFileWriter, LogLevel } from '@baileyherbert/common';

const writer = new LogFileWriter({
	fileName: 'console.log',
	logLevel: LogLevel.Info,
	encoding: 'utf8',
	formatOptions: {},
	formatEOL: '\n',             // Uses the system default
	logRotationSize: 52428800,   // 50 MiB
	logRotationDir: '.',         // Defaults to the dir of `fileName`
	logNameEnabled: true,
	logTimestampEnabled: true
});

writer.mount(logger);
```

---

## Polyfills

### `Buffer`

This class provides the same interface as Node's `Buffer`, but it works in browsers as well. When importing this class,
it will always return Node's native implementation if available.

```ts
import { Buffer } from '@baileyherbert/common';

const buffer = Buffer.from('Hello world!', 'utf8');
const hex = buffer.toString('hex');
```

---

## Promises

### `PromiseCompletionSource`

This class allows you to create a `Promise` which can easily be resolved or rejected on demand from the outside.

```ts
import { PromiseCompletionSource } from '@baileyherbert/common';

function runFakeTask() {
	const source = new PromiseCompletionSource();

	// Resolves the promise after 5 seconds
	setTimeout(() => {
		source.setResult();
	}, 5000);

	// Returns the promise object
	return source.promise;
}

// Resolves after 5 seconds
await runFakeTask();
```

### `PromiseTimeoutSource`

This class creates a promise that resolves to a boolean after the specified time, but can be cancelled prematurely. The boolean is `true` if the timeout was triggered, or `false` if cancelled.

You can also specify a custom `action` to execute when the timeout is reached.

```ts
import { PromiseTimeoutSource } from '@baileyherbert/common';
```

**Example 1:** Wait for 30 seconds

```ts
await new PromiseTimeoutSource(30000);
```

**Example 2:** Run a task after 30 seconds

```ts
new PromiseTimeoutSource(30000, () => {
	console.log('This runs after 30 seconds!');
});
```

**Example 3:** Cancel a task before it's scheduled to run

```ts
const timeout = new PromiseTimeoutSource(30000, () => {
	console.log('This runs after 30 seconds!');
});

// The action will never run because it gets cancelled after 15 sec!
setTimeout(() => timeout.cancel(), 15000);

// Confirm that it was cancelled
const result = await timeout;
console.log('The timeout was', result ? 'fulfilled' : 'cancelled');
```

You could use this to cancel and clean up an operation after a specified amount of time, but stop the cancellation
task from running if it completes in time.

---

## Reflection

### `ReflectionClass`

This class is used to retrieve the methods and metadata of a class at runtime.

Reflection can see all methods on a class, but if you want to query its return or parameter types, you'll need to apply
a decorator to it. If you don't have a decorator, use the built-in `@Reflectable()` decorator.

Here's an example class:

```ts
import { Reflectable } from '@baileyherbert/common';

class Test {
	@Reflectable()
	public printHello(name = 'world') {
		console.log('Hello', name);
	}
}
```

We'll query its own local (non-static) methods below and print their names and parameters.

```ts
import { ReflectionClass, MethodFilter } from '@baileyherbert/common';

const ref = new ReflectionClass(Test);
const methods = ref.getMethods(MethodFilter.Own | MethodFilter.Local);

for (const method of methods) {
	console.log(
		method.name,
		method.getParameters()
	);
}
```

### `ReflectionMethod`

This class allows you to query information about a class method, its parameters, and its metadata. It also makes it simple to invoke the method on demand.

Generally, you will retrieve instances of this class using `ReflectionClass`.

```ts
import { ReflectionClass, MethodFilter } from '@baileyherbert/common';

const instance = new TargetClass();
const ref = new ReflectionClass(instance);
const methods = ref.getMethods(MethodFilter.Own | MethodFilter.Local);
const method = methods.find(m => m.hasMetadata('example'));

// Invoke the method on the instance
// The first parameter is required as "this"
// The remaining parameters are sent to the method as args
method.invoke(instance);

// You can also create a closure to call the method later
const closure = method.createClosure(instance);
closure(...args);
```

---

## Native

### `Command`

This is a utility class that helps run a command or process. It provides an interface that can make it easier to manage
command line arguments, and offers simple events to listen for data or exit codes.

```ts
import { Command } from '@baileyherbert/common';

const command = new Command('ffmpeg');

command.setOption('-i', 'input_0.mp4');
command.setOption('-i', 'input_1.mp4');
command.setOption('-c', 'copy');
command.setOption('-map', '0:v:0');
command.setOption('-map', '1:a:0');
command.setFlag('-shortest');
command.setParameter('output.mp4');

// Listen for data
command.on('stderr', data => console.error(data));
command.on('stdout', data => console.log(data));

// The 'output' event combines both stderr and stdout
command.on('output', data => console.log(data));

// Start the process and wait for it to exit
const exitCode = await command.execute();
```

The class offers a `logging` option that will record all process output to an internal buffer. You can then read,
write, and clear the logged output.

```ts
// Set logging to true before executing the command
command.logging = true;
await command.execute();

// Get all output so far as a Buffer
const output = command.getLog();

// Write output to a file
await command.writeLog('filename.txt');

// Clear the log
command.clearLog();
```

---

## Decorators

### `@Reflectable`

This is a blank decorator used to trigger decorator emit for reflection. It can be applied to both classes and methods.

```ts
import { Reflectable } from '@baileyherbert/common';

@Reflectable()
class Test {}
```

---

## Types

### `Json`

These types describe data that can be serialized into (or deserialized from) a JSON string.

```ts
import { Json, JsonMap, JsonArray } from '@baileyherbert/common';
```

### `Key<T>`

This type is used to extract the keys from type, interface, or object `T`. It falls back to a generic `string` type if `T` is invalid or undefined.

```ts
import { Key } from '@baileyherbert/common';
```

### `Value<T, K, F>`

This type is used to extract the value of index `K` from object `T`. However, if the object `T` is invalid or undefined, then fallback `F` is returned.

```ts
import { Value } from '@baileyherbert/common';
```

### `Fallback<T, F>`

This type returns `T` if it is defined, or `F` otherwise.

```ts
import { Fallback } from '@baileyherbert/common';
```

### `Promisable<T>`

This type joins `T` and `Promise<T>`.

```ts
import { Promisable } from '@baileyherbert/common';
```

### `Type<T>`

This type represents the constructor of the given class `T`.

```ts
import { Type } from '@baileyherbert/common';
```

### `Action<T>`

This type represents a function that accepts any arguments with an optional return type `T` (defaults to `any`).

```ts
import { Action } from '@baileyherbert/common';
```

--

## Data structures

### `DependencyGraph`

This is a simple dependency graph used to detect circular dependencies and determine resolution paths.

```ts
import { DependencyGraph } from '@baileyherbert/common';

const graph = new DependencyGraph<string>();

// You must add nodes to the graph before attempting computations on them
graph.addNode('a');
graph.addNode('b');
graph.addNode('c');

// Register dependencies (first arg is dependent on the second)
graph.addDependency('a', 'b');
graph.addDependency('b', 'c');

// Find dependencies of specific nodes
graph.getDependenciesOf('a'); // ['c', 'b']
graph.getDependenciesOf('b'); // ['c']

// Find dependents of nodes
graph.getDependentsOf('c'); // ['a', 'b']

// Compute overall resolution order
graph.getOverallOrder(); // ['c', 'b', 'a']

// Compute resolution order of leaves
graph.getOverallOrder(true); // ['c']

// Allow circular dependencies (false by default)
graph.allowCircularDependencies = true;
```

When circular dependencies occur and `allowCircularDependencies` is false, an error will be thrown. You can catch this
error and use the information within it to determine which nodes are responsible.

```ts
import { CircularDependencyError } from '@baileyherbert/common';

// Handle circular dependency errors
try {
	graph.addDependency('c', 'a');
	graph.getOverallOrder();
}
catch (error) {
	if (error instanceof CircularDependencyError) {
		error.path; // ['a', 'b', 'c', 'a']
		error.node; // 'a'
		error.message; // Detected circular dependencies (a -> b -> c -> a)
	}
}
```
