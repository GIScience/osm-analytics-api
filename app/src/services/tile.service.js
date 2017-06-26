const logger = require('logger');
const config = require('config');
// const tilelive = require('tilelive');
const path = require('path');
const redis = require('redis');
const bluebird = require('bluebird');
const request = require('request-promise');
const PBFService = require('services/pbf.service');
const redisService = require('services/redis.service');

bluebird.promisifyAll(redis.RedisClient.prototype);

class TileService {

  constructor() {
    // const pathMbtile = path.resolve(`${__dirname}/../data/mbtiles/buildings.mbtiles`);

    // tilelive.load(`mbtiles://${pathMbtile}`, (err, source) => {
    //   if (err) {
    //     logger.error(err);
    //     process.exit(1);
    //   }
    //   logger.info('Buildings mbtile loaded correctly!!!');
    //   this.source = source;
    // });
  }


  async getTileServer(z, x, y, layer = 'buildings', cache=true) {
    let data = await redisService.getAsync(`${layer}/${z}/${x}/${y}`);
    if (data) {
      if (data === 'empty'){
        return null;
      }
      return JSON.parse(data);
    }
    logger.debug(`Cache fail ${layer}/${z}/${x}/${y}`);
    const url = `http://da-tiles.osm-analytics.org/${layer}/${z}/${x}/${y}.pbf`;
    try {
      const res = await request.get({
        url,
        encoding: null,
        resolveWithFullResponse: true,
      });

      data = await PBFService.parseTile({
        tile: res.body,
        headers: res.headers
      }, z, x, y);

      logger.debug(`Saving cache ${layer}/${z}/${x}/${y}`);
      if (cache) {
        redisService.setex(`${layer}/${z}/${x}/${y}`, JSON.stringify(data));
      }

      return data;
    } catch(err) {
      logger.debug(err);
      if (err.statusCode === 404) {
        logger.info(`Tile (${layer}/${z}/${x}/${y}) does not exist. Saving empty in cache`);
        redisService.setex(`${layer}/${z}/${x}/${y}`, 'empty');
      }
    }
  }
  async getTile(z, x, y) {
    return new Promise((resolve, reject) => {
      this.source.getTile(z, x, y, function (err, tile, headers) {
        if (err) {
          reject(err);
        } else {
          resolve({
            tile,
            headers
          });
        }
      });
    })
  }

}

module.exports = new TileService();
