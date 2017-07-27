# Redux Action Creator

[![Build Status](https://travis-ci.org/andy-shea/redux-action-creator.svg?branch=master)](https://travis-ci.org/andy-shea/redux-action-creator)
[![Code Coverage](http://codecov.io/github/andy-shea/redux-action-creator/coverage.svg?branch=master)](http://codecov.io/github/andy-shea/redux-action-creator?branch=master)

Reduce boilerplate code in your Redux action creators and types with support for [normalizr](https://github.com/paularmstrong/normalizr), [universal JavaScript](https://medium.com/@mjackson/universal-javascript-4761051b7ae9), and [Redux-first Router](https://github.com/faceyspacey/redux-first-router).

## Install

```
yarn add redux-action-creator
```

## Usage

### Action Types

Use `createTypes(types, [namespace])` to create action types with far less boilerplate.
`types` is an array of strings designating the name of the action types and `namespace` is an optional prefix to prevent name collisions.

**Before:**
```javascript
const types = {
  CREATE_CAR: 'CAR_CREATE_CAR',
  EDIT_CAR: 'CAR_EDIT_CAR',
  EDIT_WHEELS: 'CAR_EDIT_WHEELS'
};
```

**After:**
```javascript
import {createTypes} from 'redux-action-creator';

const types = createTypes(['CREATE_CAR', 'EDIT_CAR', 'EDIT_WHEELS'], 'CAR');
```

Asynchronous actions typically come in sets of three with the main action type along with a success and fail type.
Use the `async(type)` helper to generate this set.

**Before:**
```javascript
const types = {
  LOAD_CARS: 'CAR_LOAD_CARS',
  LOAD_CARS_SUCCESS: 'CAR_LOAD_CARS_SUCCESS',
  LOAD_CARS_FAIL: 'CAR_LOAD_CARS_FAIL',
  ADD_CAR: 'CAR_ADD_CAR',
  ADD_CAR_SUCCESS: 'CAR_ADD_CAR_SUCCESS',
  ADD_CAR_FAIL: 'CAR_ADD_CAR_FAIL'
};
```

**After:**
```javascript
import {createTypes, async} from 'redux-action-creator';

// use ES6 spread syntax to succinctly merge the returned asynchronous types
const types = createTypes([
  ...async('LOAD_CARS'),
  ...async('ADD_CAR')
], 'CAR');
```

### Synchronous Action Creators

Synchronous action creators can be defined using the `actionCreator(type [, paramName1, paramName2, ..., paramNameX])` helper.
This will return a function that accepts the list of params as arguments and returns an action with the given type and arguments payload.

**Before:**
```javascript
var actions = {
  createCar: function() {
    return {type: 'CAR_CREATE_CAR'};
  },
  editCar: function(car) {
    return {type: 'CAR_EDIT_CAR', payload: {
      car: car
    }};
  }
};
```

**After:**
```javascript
import {actionCreator} from 'redux-action-creator';

const actions = {
  createCar: actionCreator(types.CREATE_CAR),
  editCar: actionCreator(types.EDIT_CAR, 'car')
};
```

### Asynchronous Action Creators

Asynchronous action creators can be defined using the `asyncActionCreator(type, action|config)` helper.
If a function is passed as the second parameter, it will be treated as the asynchronous action that must return a promise,
otherwise it can be a configuration object that accepts the following values:

- `action`: an asynchronous, promise-returning action
- `schema`: a normalizr schema which will parse the response before returning
- **Note: see [Universal](#universal) usage below for more configuration options**

The action given to `asyncActionCreator` will eventually be called with the payload, the `dispatch` function, and whatever
extra arguments as determined by the async middleware and the configuration of it. For example, if used with
[redux-thunk](https://github.com/gaearon/redux-thunk), the action will be called with the payload, the `dispatch` function,
the `getState` function, and the `extraArgument` if the middleware was created via the `withExtraArgument` function.

**Before:**
```javascript
var actions = {
  loadCars: function() {
    return function(dispatch) {
      dispatch({type: 'CAR_LOAD_CARS'});

      return get('/cars').then(function(response) {
        dispatch({type: 'CAR_LOAD_CARS_SUCCESS', response: response});
      }).catch(function(err) {
        dispatch({type: 'CAR_LOAD_CARS_FAIL', error: {message: err.message, code: err.code}});
      });
    };
  },
  addCar: function(electric, wheels) {
    return function(dispatch) {
      var payload = {electric: electric, wheels: wheels};
      dispatch({type: 'CAR_ADD_CAR', payload: payload});

      return post('/cars', payload).then(function(response) {
        dispatch({
          type: 'CAR_ADD_CAR_SUCCESS',
          payload: payload,
          response: normalize(response, new Schema('cars'))
        });
      }).catch(function(err) {
        dispatch({type: 'CAR_ADD_CAR_FAIL', payload: payload, error: {message: err.message, code: err.code}});
      });
    };
  }
};
```

**After:**
```javascript
import {Schema} from 'normalizr';
import {asyncActionCreator} from 'redux-action-creator';

const actions = {
  loadCars: asyncActionCreator(types.LOAD_CARS, () => get('/cars')),
  addCar: asyncActionCreator(types.ADD_CAR, {
    action: ({electric, wheels}) => post('/cars', {electrics, wheels}),
    schema: new Schema('cars')
  })
};
```

### Universal

Instead of passing a single action to the `asyncActionCreator`, you can instead pass a `client` action and a
`server` action and the appropriate function will be executed depending on the context in which it is run.

```javascript
const actions = {
  loadCars: asyncActionCreator(types.LOAD_CARS, {
    client: () => get('/cars'),
    server: () => carService.loadCars(),
    schema: new Schema('cars')
  })
};
```
In this example, the `client` action will be executed if run in the browser whereas the `server` action will run on
the server when using a library such as [redux-connect](https://github.com/makeomatic/redux-connect).

**Note: if you have server-side only dependencies in your `server` action that will create a troublesome client webpack build,
use the custom webpack [universal-action-creator-loader](https://github.com/andy-shea/universal-action-creator-loader) to strip
the `server` action from the action creator.  All server-side dependencies must be `require`d from within the `server` function.**

### Redux-first Router

Asynchronous routes for Redux-first Router can be defined using the `asyncRoute(type, path, action|config, [helpers])` helper.
It works similar to the `asyncActionCreator` described above with the addition of the route `path` and the `helpers` object
containing any helper utilities the action may need to route correctly.  The action given to `asyncRoute` will eventually be
called with the payload, the `dispatch` function, the `getState` function, and finally the `helpers` object if given.

`asyncRoute` will return a route object of the form
```
{
  [type]: {
    path,
    thunk,
    ...rest
  }  
}
```
where `rest` is any further properties of `config` apart from `client`, `server`, and `schema` that you need to define the route.
For example, this can be used to set an `isSecure` property on the route to signify that the route requires authorisation.

The returned route object can then be merged into the final routes map to be passed to Redux-first Router's `connectRoutes` function.
```
const routesMap = {
  ROUTES_HOME: '/home',
  ...asyncRoute('ROUTES_CARS', '/cars', () => get('/cars')),
  ...asyncRoute('ROUTES_CAR', '/cars/:id', payload => get(`/cars/${payload.id}`))
}
```

Use `createRouteTypes(types)` as a shortcut to creating types with 'ROUTES' as the namespace.

## Licence

[MIT](./LICENSE)
