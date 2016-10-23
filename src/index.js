import {normalize} from 'normalizr';
import argsMap from 'argsmap';
import isNode from 'detect-node';

const SUCCESS = 'SUCCESS';
const FAIL = 'FAIL';

export function actionCreator(type, ...params) {
  return (...args) => {
    return params.reduce((action, param, index) => {
      action.payload[param] = args[index];
      return action;
    }, {type, payload: {}});
  };
}

export function asyncActionCreator(type, config) {
  if (typeof config === 'function') config = {action: config}; // eslint-disable-line no-param-reassign
  const {client, server, schema} = config;

  return (...args) => dispatch => {
    const action = config.action || (isNode ? server : client);
    const payload = argsMap(action, args);
    dispatch({type, payload});
    return action(...args).then(
        response => dispatch({
          type: `${type}_${SUCCESS}`,
          payload,
          response: schema ? normalize(response, schema) : response
        }),
        ({message, code}) => dispatch({type: `${type}_${FAIL}`, payload, error: {message, code}}));
  };
}

export function createTypes(types, namespace) {
  return types.reduce((typeMap, type) => {
    typeMap[type] = namespace ? `${namespace}_${type}` : type;
    return typeMap;
  }, {});
}

export function async(type) {
  return [type, `${type}_${SUCCESS}`, `${type}_${FAIL}`];
}
