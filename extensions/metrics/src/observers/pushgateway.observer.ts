// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/extension-metrics
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {inject, LifeCycleObserver} from '@loopback/core';
import {Pushgateway} from 'prom-client';
import {MetricsBindings} from '../keys';
import {DEFAULT_METRICS_OPTIONS, MetricsOptions} from '../types';

export class PushGatewayObserver implements LifeCycleObserver {
  private interval: NodeJS.Timeout | undefined;
  private gateway: Pushgateway;

  constructor(
    @inject(MetricsBindings.CONFIG, {optional: true})
    private options: MetricsOptions = DEFAULT_METRICS_OPTIONS,
  ) {}

  start() {
    const config = this.options.pushGateway;
    if (!config) return;
    this.gateway = new Pushgateway(config.url);
    this.interval = setInterval(() => {
      this.gateway.pushAdd({jobName: 'loopback'}, () => {});
    }, config.interval || 5000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
