// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {expect} from '@loopback/testlab';
import * as _ from 'lodash';
import {
  CrudFeatures,
  CrudRepositoryCtor,
  CrudTestContext,
  DataSourceOptions,
} from '../..';
import {
  deleteAllModelsInDefaultDataSource,
  withCrudCtx,
} from '../../helpers.repository-tests';
import {Customer, Order} from '../fixtures/models';
import {CustomerRepository, OrderRepository} from '../fixtures/repositories';
import {givenBoundCrudRepositories} from '../helpers';

export function hasManyRelationAcceptance(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  describe('HasMany relation (acceptance)', () => {
    before(deleteAllModelsInDefaultDataSource);
    // Given a Customer and Order models - see definitions at the bottom

    let customerRepo: CustomerRepository;
    let orderRepo: OrderRepository;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existingCustomerId: any;

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        ({customerRepo, orderRepo} = givenBoundCrudRepositories(
          ctx.dataSource,
        ));

        const models = [Customer, Order];
        models.forEach(async model => {
          model.definition.properties.id.type = features.idType;
          if (model === Order) {
            model.definition.properties.customerId.type = features.idType;
            model.definition.properties.shipment_id.type = features.idType;
          }
        });

        await ctx.dataSource.automigrate(models.map(m => m.name));
      }),
    );

    beforeEach(async () => {
      await orderRepo.deleteAll();
    });

    beforeEach(async () => {
      existingCustomerId = (await givenPersistedCustomerInstance()).id;
    });

    it('can create an instance of the related model', async () => {
      const order = await customerRepo.orders(existingCustomerId).create({
        description: 'order 1',
        // eslint-disable-next-line @typescript-eslint/camelcase
        shipment_id: 1,
      });

      // do this to avoid type problems of BSON type of mongodb
      expect(order.customerId.toString()).to.eql(existingCustomerId.toString());
      expect(order.description).to.eql('order 1');

      const persisted = await orderRepo.findById(order.id);
      expect(persisted.toObject()).to.deepEqual(order.toObject());
    });

    it('can find instances of the related model', async () => {
      const order = await createCustomerOrders(existingCustomerId, {
        description: 'order 1',
        // eslint-disable-next-line @typescript-eslint/camelcase
        shipment_id: 1,
      });
      const notMyOrder = await createCustomerOrders(existingCustomerId + 1, {
        description: 'order 2',
        // eslint-disable-next-line @typescript-eslint/camelcase
        shipment_id: 1,
      });
      const foundOrders = await findCustomerOrders(existingCustomerId);
      expect(foundOrders).to.containEql(order);
      expect(foundOrders).to.not.containEql(notMyOrder);

      const persisted = await orderRepo.find({
        where: {customerId: existingCustomerId},
      });
      expect(persisted).to.deepEqual(foundOrders);
    });

    it('can patch many instances', async () => {
      await createCustomerOrders(existingCustomerId, {
        description: 'order 1',
        isShipped: false,
      });
      await createCustomerOrders(existingCustomerId, {
        description: 'order 2',
        isShipped: false,
      });
      const patchObject = {isShipped: true};
      const arePatched = await patchCustomerOrders(
        existingCustomerId,
        patchObject,
      );
      expect(arePatched.count).to.equal(2);
      const patchedData = _.map(
        await findCustomerOrders(existingCustomerId),
        d => _.pick(d, ['customerId', 'description', 'isShipped']),
      );
      // convert the id type for mongo
      if (features.idType === 'string') {
        // eslint-disable-next-line require-atomic-updates
        existingCustomerId = existingCustomerId.toString();
      }
      expect(patchedData).to.eql([
        {
          customerId: existingCustomerId,
          description: 'order 1',
          isShipped: true,
        },
        {
          customerId: existingCustomerId,
          description: 'order 2',
          isShipped: true,
        },
      ]);
    });

    it('throws error when query tries to change the foreignKey', async () => {
      await expect(
        patchCustomerOrders(existingCustomerId, {
          customerId: existingCustomerId + 1,
        }),
      ).to.be.rejectedWith(/Property "customerId" cannot be changed!/);
    });

    it('can delete many instances', async () => {
      await createCustomerOrders(existingCustomerId, {
        description: 'order 1',
      });
      await createCustomerOrders(existingCustomerId, {
        description: 'order 2',
      });
      const deletedOrders = await deleteCustomerOrders(existingCustomerId);
      expect(deletedOrders.count).to.equal(2);
      const relatedOrders = await findCustomerOrders(existingCustomerId);
      expect(relatedOrders).to.be.empty();
    });

    it("does not delete instances that don't belong to the constrained instance", async () => {
      const newOrder = {
        customerId: existingCustomerId + 1,
        description: 'another order',
      };
      await orderRepo.create(newOrder);
      await deleteCustomerOrders(existingCustomerId);
      const orders = await orderRepo.find();
      expect(orders).to.have.length(1);
      expect(_.pick(orders[0], ['customerId', 'description'])).to.eql(newOrder);
    });

    it('does not create an array of the related model', async () => {
      await expect(
        customerRepo.create({
          name: 'a customer',
          orders: [
            {
              description: 'order 1',
            },
          ],
        }),
      ).to.be.rejectedWith(/`orders` is not defined/);
    });

    context('when targeting the source model', () => {
      it('gets the parent entity through the child entity', async () => {
        const parent = await customerRepo.create({name: 'parent customer'});
        const child = await customerRepo.create({
          name: 'child customer',
          parentId: parent.id,
        });

        const childsParent = await getParentCustomer(child.id);

        expect(_.pick(childsParent, ['id', 'name'])).to.eql(
          _.pick(parent, ['id', 'name']),
        );
      });

      it('creates a child entity through the parent entity', async () => {
        const parent = await customerRepo.create({
          name: 'parent customer',
        });
        const child = await createCustomerChildren(parent.id, {
          name: 'child customer',
        });
        expect(child.parentId).to.equal(parent.id);

        const children = await findCustomerChildren(parent.id);
        expect(children).to.containEql(child);
      });
    });

    // This should be enforced by the database to avoid race conditions
    it.skip('reject create request when the customer does not exist');

    // repository helper methods
    async function createCustomerOrders(
      customerId: number,
      orderData: Partial<Order>,
    ): Promise<Order> {
      return customerRepo.orders(customerId).create(orderData);
    }

    async function findCustomerOrders(customerId: number) {
      return customerRepo.orders(customerId).find();
    }

    async function patchCustomerOrders(
      customerId: number,
      order: Partial<Order>,
    ) {
      return customerRepo.orders(customerId).patch(order);
    }

    async function deleteCustomerOrders(customerId: number) {
      return customerRepo.orders(customerId).delete();
    }

    async function getParentCustomer(customerId: number) {
      return customerRepo.parent(customerId);
    }

    async function createCustomerChildren(
      customerId: number,
      customerData: Partial<Customer>,
    ) {
      return customerRepo.customers(customerId).create(customerData);
    }

    async function findCustomerChildren(customerId: number) {
      return customerRepo.customers(customerId).find();
    }

    async function givenPersistedCustomerInstance() {
      return customerRepo.create({name: 'a customer'});
    }
  });
}
