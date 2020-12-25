import { DynamicModule, Global, HttpModule, HttpService, Module } from '@nestjs/common';
import { BillPlzService } from './billplz.service';
import { BillPlzOptions, CONFIG_OPTIONS } from './billplz.definition';

@Global()
@Module({})
export class BillPlzModule {
  static forRoot(options: BillPlzOptions): DynamicModule {
    return {
      module: BillPlzModule,
      imports: [HttpModule],
      providers: [
        {
          provide: CONFIG_OPTIONS,
          useValue: options,
        },
        BillPlzService,
      ],
      exports: [BillPlzService],
    };
  }
}
