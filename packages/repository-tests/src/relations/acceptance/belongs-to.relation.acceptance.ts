// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {juggler} from '@loopback/repository';
import {expect} from '@loopback/testlab';
import {
  deleteAllModelsInDefaultDataSource,
  withCrudCtx,
} from '../../helpers.repository-tests';
import {
  CrudFeatures,
  CrudRepositoryCtor,
  CrudTestContext,
  DataSourceOptions,
} from '../../types.repository-tests';
import {Customer, Order, Shipment} from '../fixtures/models';
import {
  CustomerRepository,
  OrderRepository,
  ShipmentRepository,
} from '../fixtures/repositories';

export function belongsToRelationAcceptance(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  describe('BelongsTo relation (acceptance)', () => {
    before(deleteAllModelsInDefaultDataSource);

    // Given a Customer and Order models - see definitions at the bottom
    let customerRepo: CustomerRepository;
    let orderRepo: OrderRepository;
    let shipmentRepo: ShipmentRepository;

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        const models = [Customer, Order, Shipment];
        models.forEach(model => {
          model.definition.properties.id.type = features.idType;
          if (model === Order) {
            model.definition.properties.customerId.type = features.idType;
            model.definition.properties.shipment_id.type = features.idType;
          }
        });

        await givenBoundCrudRepositories(ctx.dataSource);
        await ctx.dataSource.automigrate(Customer.name);
        await ctx.dataSource.automigrate(Order.name);
        await ctx.dataSource.automigrate(Shipment.name);
      }),
    );

    beforeEach(async () => {
      await orderRepo.deleteAll();
    });

    it('can find customer of order', async () => {
      const customer = await customerRepo.create({
        name: 'Order McForder',
        parentId: 1,
      });
      const order = await orderRepo.create({
        customerId: customer.id,
        description: 'Order from Order McForder, the hoarder of Mordor',
      });

      const result = await orderRepo.customer(order.id);
      expect(result).to.deepEqual(customer);
    });

    it('can find shipment of order with a custom foreign key name', async () => {
      const shipment = await shipmentRepo.create({
        name: 'Tuesday morning shipment',
      });
      const order = await orderRepo.create({
        // eslint-disable-next-line @typescript-eslint/camelcase
        shipment_id: shipment.id,
        description: 'Order that is shipped Tuesday morning',
      });
      const result = await orderRepo.shipment(order.id);
      expect(result).to.deepEqual(shipment);
    });

    //--- HELPERS ---//

    async function givenBoundCrudRepositories(db: juggler.DataSource) {
      orderRepo = new OrderRepository(
        db,
        async () => customerRepo,
        async () => shipmentRepo,
      );
      customerRepo = new repositoryClass(Customer, db) as CustomerRepository;
      shipmentRepo = new repositoryClass(Shipment, db) as ShipmentRepository;
    }
  });
}
