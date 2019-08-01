// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Context} from '@loopback/context';
import {expect} from '@loopback/testlab';
import {service} from '../..';

describe('@service', () => {
  let ctx: Context;

  beforeEach(givenContext);

  it('injects a service using constructor with serviceClass argument', async () => {
    class MyController {
      constructor(@service(MyService) public myService: MyService) {}
    }
    ctx.bind('controllers.MyController').toClass(MyController);

    const controller = await ctx.get<MyController>('controllers.MyController');
    expect(controller.myService).to.be.instanceOf(MyService);
  });

  it('injects a service using property', async () => {
    class MyController {
      @service(MyService) public myService: MyService;
    }
    ctx.bind('controllers.MyController').toClass(MyController);

    const controller = await ctx.get<MyController>('controllers.MyController');
    expect(controller.myService).to.be.instanceOf(MyService);
  });

  it('injects a service without serviceClass argument', async () => {
    class MyController {
      constructor(@service() public myService: MyService) {}
    }
    ctx.bind('controllers.MyController').toClass(MyController);

    const controller = await ctx.get<MyController>('controllers.MyController');
    expect(controller.myService).to.be.instanceOf(MyService);
  });

  it('injects a service matching a sub class', async () => {
    class MyController {
      constructor(@service(MyService) public myService: MyService) {}
    }
    ctx.unbind('services.MyService');
    ctx.bind('services.MySubService').toClass(MySubService);
    ctx.bind('controllers.MyController').toClass(MyController);

    const controller = await ctx.get<MyController>('controllers.MyController');
    expect(controller.myService).to.be.instanceOf(MySubService);
  });

  it('allows optional flag', async () => {
    class MyController {
      constructor(
        @service(MyService, {optional: true}) public myService?: MyService,
      ) {}
    }

    ctx.unbind('services.MyService');
    ctx.bind('controllers.MyController').toClass(MyController);

    const controller = await ctx.get<MyController>('controllers.MyController');
    expect(controller.myService).to.be.undefined();
  });

  it('allows skipSubClasses flag', async () => {
    class MyController {
      constructor(
        @service(MyService, {skipSubClasses: true}) public myService: MyService,
      ) {}
    }
    ctx.bind('services.MySubService').toClass(MySubService);
    ctx.bind('controllers.MyController').toClass(MyController);

    const controller = await ctx.get<MyController>('controllers.MyController');
    expect(controller.myService).to.be.instanceOf(MyService);
    expect(controller.myService).to.be.not.instanceOf(MySubService);
  });

  it('throws error if no binding is found', async () => {
    class MyController {
      constructor(@service(MyService) public myService?: MyService) {}
    }

    ctx.unbind('services.MyService');
    ctx.bind('controllers.MyController').toClass(MyController);

    await expect(
      ctx.get<MyController>('controllers.MyController'),
    ).to.be.rejectedWith(/No binding found for MyService/);
  });

  it('throws error when more than one services are bound', async () => {
    class MyController {
      constructor(@service() public myService: MyService) {}
    }

    ctx.bind('services.MyService2').toClass(MyService);
    ctx.bind('controllers.MyController').toClass(MyController);

    await expect(
      ctx.get<MyController>('controllers.MyController'),
    ).to.be.rejectedWith(/More than one bindings found for MyService/);
  });

  it('throws error if the parameter type cannot be inferred', async () => {
    class MyController {
      constructor(@service() public myService: unknown) {}
    }

    ctx.bind('controllers.MyController').toClass(MyController);

    await expect(
      ctx.get<MyController>('controllers.MyController'),
    ).to.be.rejectedWith(/Service class cannot be inferred from design type/);
  });

  it('throws error if the property type cannot be inferred', async () => {
    class MyController {
      @service() public myService: string[];
    }

    ctx.bind('controllers.MyController').toClass(MyController);

    await expect(
      ctx.get<MyController>('controllers.MyController'),
    ).to.be.rejectedWith(/Service class cannot be inferred from design type/);
  });

  class MyService {}

  class MySubService extends MyService {}

  function givenContext() {
    ctx = new Context();
    ctx.bind('services.MyService').toClass(MyService);
  }
});
