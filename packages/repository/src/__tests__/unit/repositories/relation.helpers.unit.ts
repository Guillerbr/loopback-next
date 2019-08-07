// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/repository
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {expect, toJSON} from '@loopback/testlab';
import {
  DefaultCrudRepository,
  findByForeignKeys,
  includeRelatedModels,
  juggler,
} from '../../..';
import {model, property} from '../../../decorators';
import {Entity} from '../../../model';
import {
  belongsTo,
  BelongsToAccessor,
  Getter,
  hasMany,
  HasManyRepositoryFactory,
  InclusionResolver,
} from '../../../relations';

describe('relation helpers', () => {
  let productRepo: ProductRepository;
  let categoryRepo: CategoryRepository;

  before(() => {
    productRepo = new ProductRepository(testdb);
    categoryRepo = new CategoryRepository(testdb, async () => productRepo);
  });

  describe('findByForeignKeys', () => {
    beforeEach(async () => {
      await productRepo.deleteAll();
    });

    it('returns an empty array when no foreign keys are passed in', async () => {
      const fkIds: number[] = [];
      await productRepo.create({id: 1, name: 'product', categoryId: 1});
      const products = await findByForeignKeys(
        productRepo,
        'categoryId',
        fkIds,
      );
      expect(products).to.be.empty();
    });

    it('returns an empty array when no instances have the foreign key value', async () => {
      await productRepo.create({id: 1, name: 'product', categoryId: 1});
      const products = await findByForeignKeys(productRepo, 'categoryId', 2);
      expect(products).to.be.empty();
    });

    it('returns an empty array when no instances have the foreign key values', async () => {
      await productRepo.create({id: 1, name: 'product', categoryId: 1});
      const products = await findByForeignKeys(productRepo, 'categoryId', [
        2,
        3,
      ]);
      expect(products).to.be.empty();
    });

    it('returns all instances that have the foreign key value', async () => {
      const pens = await productRepo.create({name: 'pens', categoryId: 1});
      const pencils = await productRepo.create({
        name: 'pencils',
        categoryId: 1,
      });
      const products = await findByForeignKeys(productRepo, 'categoryId', 1);
      expect(products).to.deepEqual([pens, pencils]);
    });

    it('does not include instances with different foreign key values', async () => {
      const pens = await productRepo.create({name: 'pens', categoryId: 1});
      const pencils = await productRepo.create({
        name: 'pencils',
        categoryId: 2,
      });
      const products = await findByForeignKeys(productRepo, 'categoryId', 1);
      expect(products).to.deepEqual([pens]);
      expect(products).to.not.containDeep(pencils);
    });

    it('includes instances when there is one value in the array of foreign key values', async () => {
      const pens = await productRepo.create({name: 'pens', categoryId: 1});
      const pencils = await productRepo.create({
        name: 'pencils',
        categoryId: 2,
      });
      const products = await findByForeignKeys(productRepo, 'categoryId', [2]);
      expect(products).to.deepEqual([pencils]);
      expect(products).to.not.containDeep(pens);
    });

    it('returns all instances that have any of multiple foreign key values', async () => {
      const pens = await productRepo.create({name: 'pens', categoryId: 1});
      const pencils = await productRepo.create({
        name: 'pencils',
        categoryId: 2,
      });
      const paper = await productRepo.create({name: 'paper', categoryId: 3});
      const products = await findByForeignKeys(productRepo, 'categoryId', [
        1,
        3,
      ]);
      expect(products).to.deepEqual([pens, paper]);
      expect(products).to.not.containDeep(pencils);
    });

    it('throws error if scope is passed in and is non-empty', async () => {
      let errorMessage;
      try {
        await findByForeignKeys(productRepo, 'categoryId', [1], {
          limit: 1,
        });
      } catch (error) {
        errorMessage = error.message;
      }
      expect(errorMessage).to.eql('scope is not supported');
    });

    it('does not throw an error if scope is passed in and is undefined or empty', async () => {
      let products = await findByForeignKeys(
        productRepo,
        'categoryId',
        [1],
        undefined,
        {},
      );
      expect(products).to.be.empty();
      products = await findByForeignKeys(productRepo, 'categoryId', 1, {}, {});
      expect(products).to.be.empty();
    });
  });

  describe('includeRelatedModels', () => {
    beforeEach(async () => {
      await productRepo.deleteAll();
      await categoryRepo.deleteAll();
    });

    it("defines a repository's inclusionResolvers property", () => {
      expect(categoryRepo.inclusionResolvers).to.not.be.undefined();
      expect(productRepo.inclusionResolvers).to.not.be.undefined();
    });

    it('returns source model if no filter is passed in', async () => {
      const category = await categoryRepo.create({name: 'category 1'});
      await categoryRepo.create({name: 'category 2'});
      const result = await includeRelatedModels(categoryRepo, [category]);
      expect(result).to.eql([category]);
    });

    it('throws error if the target repository does not have the registered resolver', async () => {
      const category = await categoryRepo.create({name: 'category 1'});
      await expect(
        includeRelatedModels(
          categoryRepo,
          [category],
          [{relation: 'products'}],
        ),
      ).to.be.rejectedWith(
        /Invalid "filter.include" entries: {"relation":"products"}/,
      );
    });

    it('returns an empty array if target model of the source entity does not have any matched instances', async () => {
      const category = await categoryRepo.create({name: 'category'});

      categoryRepo.inclusionResolvers.set('products', hasManyResolver);

      const categories = await includeRelatedModels(
        categoryRepo,
        [category],
        [{relation: 'products'}],
      );

      expect(categories[0].products).to.be.empty();
    });

    it('includes related model for one instance - belongsTo', async () => {
      const category = await categoryRepo.create({name: 'category'});
      const product = await productRepo.create({
        name: 'product',
        categoryId: category.id,
      });

      productRepo.inclusionResolvers.set('category', belongsToResolver);

      const productWithCategories = await includeRelatedModels(
        productRepo,
        [product],
        [{relation: 'category'}],
      );

      expect(productWithCategories[0].toJSON()).to.deepEqual({
        ...product.toJSON(),
        category: category.toJSON(),
      });
    });

    it('includes related model for more than one instance - belongsTo', async () => {
      const categoryOne = await categoryRepo.create({name: 'category 1'});
      const productOne = await productRepo.create({
        name: 'product 1',
        categoryId: categoryOne.id,
      });

      const categoryTwo = await categoryRepo.create({name: 'category 2'});
      const productTwo = await productRepo.create({
        name: 'product 2',
        categoryId: categoryTwo.id,
      });

      const productThree = await productRepo.create({
        name: 'product 3',
        categoryId: categoryTwo.id,
      });

      productRepo.inclusionResolvers.set('category', belongsToResolver);

      const productWithCategories = await includeRelatedModels(
        productRepo,
        [productOne, productTwo, productThree],
        [{relation: 'category'}],
      );

      expect(toJSON(productWithCategories)).to.deepEqual([
        {...productOne.toJSON(), category: categoryOne.toJSON()},
        {...productTwo.toJSON(), category: categoryTwo.toJSON()},
        {...productThree.toJSON(), category: categoryTwo.toJSON()},
      ]);
    });

    it('includes related models for one instance - hasMany', async () => {
      const category = await categoryRepo.create({name: 'category'});
      const productOne = await productRepo.create({
        name: 'product 1',
        categoryId: category.id,
      });

      const productTwo = await productRepo.create({
        name: 'product 2',
        categoryId: category.id,
      });

      categoryRepo.inclusionResolvers.set('products', hasManyResolver);

      const categoryWithProducts = await includeRelatedModels(
        categoryRepo,
        [category],
        [{relation: 'products'}],
      );

      expect(toJSON(categoryWithProducts)).to.deepEqual([
        {
          ...category.toJSON(),
          products: [productOne.toJSON(), productTwo.toJSON()],
        },
      ]);
    });

    it('includes related models for more than one instance - hasMany', async () => {
      const categoryOne = await categoryRepo.create({name: 'category 1'});
      const productOne = await productRepo.create({
        name: 'product 1',
        categoryId: categoryOne.id,
      });

      const categoryTwo = await categoryRepo.create({name: 'category 2'});
      const productTwo = await productRepo.create({
        name: 'product 2',
        categoryId: categoryTwo.id,
      });

      const categoryThree = await categoryRepo.create({name: 'category 3'});
      const productThree = await productRepo.create({
        name: 'product 3',
        categoryId: categoryTwo.id,
      });

      categoryRepo.inclusionResolvers.set('products', hasManyResolver);

      const categoryWithProducts = await includeRelatedModels(
        categoryRepo,
        [categoryOne, categoryTwo, categoryThree],
        [{relation: 'products'}],
      );

      expect(toJSON(categoryWithProducts)).to.deepEqual([
        {...categoryOne.toJSON(), products: [productOne.toJSON()]},
        {
          ...categoryTwo.toJSON(),
          products: [productTwo.toJSON(), productThree.toJSON()],
        },
        {...categoryThree.toJSON(), products: []},
      ]);
    });
  });

  /******************* HELPERS *******************/

  // stubbed resolvers

  const belongsToResolver: InclusionResolver<
    Product,
    Category
  > = async entities => {
    const categories = [];

    for (const product of entities) {
      const category = await categoryRepo.findById(product.categoryId);
      categories.push(category);
    }

    return categories;
  };

  const hasManyResolver: InclusionResolver<
    Category,
    Product
  > = async entities => {
    const products = [];

    for (const category of entities) {
      const product = await categoryRepo.products(category.id).find();
      products.push(product);
    }
    return products;
  };

  // models and repositories

  @model()
  class Product extends Entity {
    @property({id: true})
    id: number;
    @property()
    name: string;
    @belongsTo(() => Category)
    categoryId: number;
  }

  class ProductRepository extends DefaultCrudRepository<
    Product,
    typeof Product.prototype.id
  > {
    public readonly category: BelongsToAccessor<
      Category,
      typeof Product.prototype.id
    >;
    constructor(
      dataSource: juggler.DataSource,
      categoryRepository?: Getter<CategoryRepository>,
    ) {
      super(Product, dataSource);
      if (categoryRepository)
        this.category = this.createBelongsToAccessorFor(
          'category',
          categoryRepository,
        );
    }
  }

  @model()
  class Category extends Entity {
    @property({id: true})
    id?: number;
    @property()
    name: string;
    @hasMany(() => Product, {keyTo: 'categoryId'})
    products?: Product[];
  }
  interface CategoryRelations {
    products?: Product[];
  }

  class CategoryRepository extends DefaultCrudRepository<
    Category,
    typeof Category.prototype.id,
    CategoryRelations
  > {
    public readonly products: HasManyRepositoryFactory<
      Product,
      typeof Category.prototype.id
    >;
    constructor(
      dataSource: juggler.DataSource,
      productRepository: Getter<ProductRepository>,
    ) {
      super(Category, dataSource);
      this.products = this.createHasManyRepositoryFactoryFor(
        'products',
        productRepository,
      );
    }
  }

  const testdb: juggler.DataSource = new juggler.DataSource({
    name: 'db',
    connector: 'memory',
  });
});
