// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository-tests
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Getter} from '@loopback/context';
import {
  DefaultCrudRepository,
  Entity,
  EntityCrudRepository,
  hasMany,
  HasManyRepositoryFactory,
  juggler,
  model,
  property,
} from '@loopback/repository';
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

export function hasManyWithoutDIRelationAcceptance(
  dataSourceOptions: DataSourceOptions,
  repositoryClass: CrudRepositoryCtor,
  features: CrudFeatures,
) {
  describe('HasMany relation without di (acceptance)', () => {
    before(deleteAllModelsInDefaultDataSource);
    // Given a Customer and Order models - see definitions at the bottom

    // let existingCustomerId: number;
    let ds: juggler.DataSource;
    let customerRepo: CustomerRepository;
    let orderRepo: OrderRepository;

    before(
      withCrudCtx(async function setupRepository(ctx: CrudTestContext) {
        givenDataSource(ctx.dataSource);
        givenOrderRepository();
        givenCustomerRepository();
        await ctx.dataSource.automigrate(Customer.name);
        await ctx.dataSource.automigrate(Order.name);
      }),
    );

    // before(givenDataSource(ctx.dataSource));
    // before(givenOrderRepository);
    // before(givenCustomerRepository);
    beforeEach(async () => {
      await orderRepo.deleteAll();
      //existingCustomerId = (await givenPersistedCustomerInstance()).id;
    });

    it('can create an instance of the related model (acceptance)', async () => {
      async function createCustomerOrders(
        customerId: number,
        orderData: Partial<Order>,
      ): Promise<Order> {
        return customerRepo.orders(customerId).create(orderData);
      }
      const customerA = await customerRepo.create({name: 'customer A'});
      const order = await createCustomerOrders(customerA.id, {
        description: 'order 1',
      });
      expect({
        customerId: order.id.valueOf(),
        description: order.description,
      }).to.eql({
        customerId: customerA.id,
        description: 'order 1',
      });

      const persisted = await orderRepo.findById(order.id);
      console.log(persisted);
      expect(persisted.toObject()).to.deepEqual(order.toObject());
    });

    it('can find instances of the related model (acceptance)', async () => {
      async function createCustomerOrders(
        customerId: number,
        orderData: Partial<Order>,
      ): Promise<Order> {
        return customerRepo.orders(customerId).create(orderData);
      }
      async function findCustomerOrders(customerId: number) {
        return customerRepo.orders(customerId).find();
      }
      const customerB = await customerRepo.create({name: 'customer B'});
      const customerC = await customerRepo.create({name: 'customer c'});

      const order = await createCustomerOrders(customerB.id, {
        description: 'order 1',
      });
      console.log(typeof customerB.id);
      console.log(customerB);
      console.log(typeof order.id);
      console.log(order);

      const notMyOrder = await createCustomerOrders(customerC.id, {
        description: 'order 2',
      });
      const orders = await findCustomerOrders(customerB.id);

      expect(orders).to.containEql(order);
      expect(orders).to.not.containEql(notMyOrder);

      const persisted = await orderRepo.find({
        where: {customerId: customerB.id},
      });
      expect(persisted).to.deepEqual(orders);
    });

    //--- HELPERS ---//

    @model()
    class Order extends Entity {
      @property({
        type: features.idType,
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
        type: features.idType,
        required: true,
      })
      customerId: number;
    }

    @model()
    class Customer extends Entity {
      @property({
        type: features.idType,
        id: true,
        generated: true,
      })
      id: number;

      @property({
        type: 'string',
      })
      name: string;

      @hasMany(() => Order)
      orders: Order[];
    }

    class OrderRepository extends DefaultCrudRepository<
      Order,
      typeof Order.prototype.id
    > {
      constructor(db: juggler.DataSource) {
        super(Order, db);
      }
    }

    class CustomerRepository extends DefaultCrudRepository<
      Customer,
      typeof Customer.prototype.id
    > {
      public readonly orders: HasManyRepositoryFactory<
        Order,
        typeof Customer.prototype.id
      >;

      constructor(
        protected db: juggler.DataSource,
        orderRepositoryGetter: Getter<
          EntityCrudRepository<Order, typeof Order.prototype.id>
        >,
      ) {
        super(Customer, db);
        this.orders = this._createHasManyRepositoryFactoryFor(
          'orders',
          orderRepositoryGetter,
        );
      }
    }

    function givenDataSource(db: juggler.DataSource) {
      ds = db;
    }

    function givenOrderRepository() {
      orderRepo = new OrderRepository(ds);
    }

    function givenCustomerRepository() {
      customerRepo = new CustomerRepository(ds, Getter.fromValue(orderRepo));
    }

    // async function givenPersistedCustomerInstance() {
    //   return customerRepo.create({name: 'a customer'});
    // }
  });
}
