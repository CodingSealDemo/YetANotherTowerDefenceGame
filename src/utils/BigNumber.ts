import Decimal from 'break_infinity.js';

export type BigNumberish = Decimal | string | number | BigNumber;

export class BigNumber {
  private value: Decimal;

  constructor(val: BigNumberish = 0) {
    if (val instanceof BigNumber) {
      this.value = val.value;
    } else if (val instanceof Decimal) {
      this.value = val;
    } else if (typeof val === 'string' || typeof val === 'number') {
      this.value = new Decimal(val);
    } else if (val && typeof (val as any).mantissa === 'number' && typeof (val as any).exponent === 'number') {
      const man = (val as any).mantissa;
      const exp = (val as any).exponent;
      this.value = new Decimal(man).mul(new Decimal(10).pow(exp));
    } else {
      this.value = new Decimal(0);
    }
  }

  public static from(val: BigNumberish): BigNumber {
    return new BigNumber(val);
  }

  public add(other: BigNumberish): BigNumber {
    return new BigNumber(this.value.add(new BigNumber(other).value));
  }

  public sub(other: BigNumberish): BigNumber {
    return new BigNumber(this.value.sub(new BigNumber(other).value));
  }

  public mul(other: BigNumberish): BigNumber {
    return new BigNumber(this.value.mul(new BigNumber(other).value));
  }

  public div(other: BigNumberish): BigNumber {
    return new BigNumber(this.value.div(new BigNumber(other).value));
  }

  public pow(other: number): BigNumber {
    return new BigNumber(this.value.pow(other));
  }

  public gte(other: BigNumberish): boolean {
    return this.value.gte(new BigNumber(other).value);
  }

  public gt(other: BigNumberish): boolean {
    return this.value.gt(new BigNumber(other).value);
  }

  public lte(other: BigNumberish): boolean {
    return this.value.lte(new BigNumber(other).value);
  }

  public lt(other: BigNumberish): boolean {
    return this.value.lt(new BigNumber(other).value);
  }

  public eq(other: BigNumberish): boolean {
    return this.value.eq(new BigNumber(other).value);
  }

  public toNumber(): number {
    return this.value.toNumber();
  }

  public toString(): string {
    return this.value.toString();
  }

  public toFormattedString(): string {
    if (this.value.abs().lt(1000)) {
      return this.value.toFixed(1).replace(/\.0$/, '');
    }
    const exp = this.value.exponent;
    const man = this.value.mantissa;
    return `${man.toFixed(2)}e${exp}`;
  }

  public getRawDecimal(): Decimal {
    return this.value;
  }
}
