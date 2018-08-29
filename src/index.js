import {normalize} from 'normalizr';
import isNode from 'detect-node';

const SUCCESS = 'SUCCESS';
const FAIL = 'FAIL';

function filterPayload(props, payload) {
  return props.reduce((filteredPayload, prop) => {
    filteredPayload[prop] = payload[prop];
    return filteredPayload;
  }, {});
}

export function actionCreator(type, ...props) {
  return payload => ({type, payload: filterPayload(props, payload)});
}

function executeAsyncAction(
  type,
  payload,
  helpers,
  config,
  dispatchExtraConfigProperies,
  dispatch,
  args
) {
  if (typeof config === 'function') config = {action: config}; // eslint-disable-line no-param-reassign
  const {client, server, schema, ...rest} = config;
  const action = config.action || (isNode ? server : client);
  const extra = dispatchExtraConfigProperies ? rest : {};
  return action(payload, {...helpers, dispatch}, ...args).then(
    response =>
      dispatch({
        type: `${type}_${SUCCESS}`,
        payload,
        response: schema ? normalize(response, schema) : response,
        ...extra
      }),
    error => dispatch({type: `${type}_${FAIL}`, payload, error, ...extra})
  );
}

export function asyncActionCreator(type, ...propsAndConfig) {
  const config = propsAndConfig.pop();
  const {client, server, schema, ...rest} = typeof config === 'function' ? {} : config;
  return (payload, helpers) => (dispatch, ...args) => {
    const filteredPayload = filterPayload(propsAndConfig, payload);
    dispatch({type, payload: filteredPayload, ...rest});
    return executeAsyncAction(type, filteredPayload, helpers, config, true, dispatch, args);
  };
}

export function asyncRoute(type, path, config, helpers) {
  const {client, server, schema, ...rest} = config;
  return {
    [type]: {
      path,
      thunk: (dispatch, getState) => {
        const state = getState();
        const {
          location: {payload}
        } = state;
        return executeAsyncAction(type, payload, helpers, config, false, dispatch, [getState]);
      },
      ...rest
    }
  };
}

export function createTypes(types, namespace) {
  return types.reduce((typeMap, type) => {
    typeMap[type] = namespace ? `${namespace}_${type}` : type;
    return typeMap;
  }, {});
}

export function createRouteTypes(types) {
  return createTypes(types, 'ROUTES');
}

export function async(type) {
  return [type, `${type}_${SUCCESS}`, `${type}_${FAIL}`];
}
