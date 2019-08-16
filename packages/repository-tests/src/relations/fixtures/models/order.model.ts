// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Customer, CustomerWithRelations} from './customer.model';
import {Shipment, ShipmentWithRelations} from './shipment.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
  },
})
export class Order extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id: number;

  @property({
    type: 'string',
    required: true,
  })
  description: string;

  @property({
    type: 'boolean',
    required: false,
    default: false,
  })
  isShipped: boolean;

  @belongsTo(() => Customer)
  customerId: number;

  @belongsTo(() => Shipment, {name: 'shipment'})
  shipment_id: number;
}

export interface OrderRelations {
  customer?: CustomerWithRelations;
  shipment?: ShipmentWithRelations;
}

export type OrderWithRelations = Order & OrderRelations;
