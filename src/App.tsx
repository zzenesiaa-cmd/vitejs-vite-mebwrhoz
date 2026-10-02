import { useEffect, useMemo, useState } from "react";

type Payment = {
  id: string;
  debtId: number;
  month: string;
  amount: number;
  date: string;
};

type Debt = {
  id: number;
  name: string;
  balance: number;
  monthlyPayment: number;
  history: Payment[];

  // Borcun hangi ay tamamen bittiği
  paidOffMonth?: string;

  // Hangi ödeme ile tamamen bittiği
  paidOffByPaymentId?: string;
};

type SalaryRecord = {
  [month: string]: number;
};

type GoldPurchase = {
  id: string;
  date: string;
  month: string;
  grams: number;
  totalCost: number;
  pricePerGram: number;
  note?: string;
};

type ReallocationTarget =
  | "gold"
  | "living"
  | "emergency"
  | "debt"
  | "unallocated";

type Reallocation = {
  id: string;

  // Parayı serbest bırakan borç
  sourceDebtId: number;
  sourceDebtName: string;

  // Serbest kalan aylık tutar
  amount: number;

  // Hangi aydan itibaren geçerli
  effectiveMonth: string;

  // Nereye aktarıldı
  target: ReallocationTarget;

  // Hedef başka bir borçsa
  targetDebtId?: number;

  // Bu aktarımı hangi ödeme oluşturdu?
  triggerPaymentId: string;
};

type Tab =
  | "home"
  | "debts"
  | "plan"
  | "savings"
  | "reports"
  | "payments";

const FIRST_PAYMENT_MONTH = "2026-11";

const DEFAULT_SALARY = 28075.5;

const PLANNED_GOLD = 6700;
const PLANNED_LIVING = 9000;
const PLANNED_EMERGENCY = 2375.5;

const NOVEMBER_DEBT_PLAN: Record<
  string,
  number
> = {
  "Garanti Avans Hesap": 4000,
  "Yapı Kredi": 3000,
  "Garanti Kredi": 1500,
  QNB: 1500,
};

const initialDebts: Debt[] = [
  {
    id: 1,
    name: "Garanti Avans Hesap",
    balance: 98523.33,
    monthlyPayment: 4000,
    history: [],
  },
  {
    id: 2,
    name: "Yapı Kredi",
    balance: 15387.07,
    monthlyPayment: 3000,
    history: [],
  },
  {
    id: 3,
    name: "Garanti Kredi",
    balance: 5000,
    monthlyPayment: 1500,
    history: [],
  },
  {
    id: 4,
    name: "QNB",
    balance: 8381,
    monthlyPayment: 1500,
    history: [],
  },
];

const monthNames = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  if (!year || !monthNumber) {
    return month;
  }

  return `${monthNames[monthNumber - 1]} ${year}`;
}

function generateMonths() {
  const result: string[] = [];

  const start = new Date(2026, 9, 1);

  for (let i = 0; i < 12; i++) {
    const date = new Date(start);

    date.setMonth(start.getMonth() + i);

    result.push(
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`
    );
  }

  return result;
}

function nextMonth(month: string) {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  const date = new Date(
    year,
    monthNumber - 1,
    1
  );

  date.setMonth(date.getMonth() + 1);

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

const availableMonths = generateMonths();

function App() {
  const [activeTab, setActiveTab] =
    useState<Tab>("home");

  const [selectedMonth, setSelectedMonth] =
    useState("2026-10");

  /* ==================================================
     MAAS
  ================================================== */

  const [salaryRecords, setSalaryRecords] =
    useState<SalaryRecord>(() => {
      try {
        const saved =
          localStorage.getItem(
            "butcem-salaries"
          );

        if (saved) {
          return JSON.parse(saved);
        }
      } catch {}

      return {
        "2026-10": DEFAULT_SALARY,
      };
    });

  /* ==================================================
     BORCLAR
  ================================================== */

  const [debts, setDebts] =
    useState<Debt[]>(() => {
      try {
        const saved =
          localStorage.getItem(
            "butcem-debts"
          );

        if (saved) {
          const parsed =
            JSON.parse(saved);

          return parsed.map(
            (debt: any) => ({
              ...debt,

              history:
                Array.isArray(
                  debt.history
                )
                  ? debt.history.map(
                      (
                        payment: any
                      ) => ({
                        ...payment,

                        id:
                          payment.id ||
                          crypto.randomUUID(),

                        debtId:
                          debt.id,
                      })
                    )
                  : [],
            })
          );
        }
      } catch {}

      return initialDebts;
    });

  /* ==================================================
     ALTIN
  ================================================== */

  const [goldPurchases, setGoldPurchases] =
    useState<GoldPurchase[]>(() => {
      try {
        const saved =
          localStorage.getItem(
            "butcem-gold"
          );

        if (saved) {
          return JSON.parse(saved);
        }
      } catch {}

      return [];
    });

  /* ==================================================
     YENİ:
     BORÇ BİTİNCE PARA NEREYE GİDECEK?
  ================================================== */

  const [
    reallocations,
    setReallocations,
  ] = useState<Reallocation[]>(() => {
    try {
      const saved =
        localStorage.getItem(
          "butcem-reallocations"
        );

      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}

    return [];
  });

  const [
    pendingReallocation,
    setPendingReallocation,
  ] =
    useState<{
      sourceDebtId: number;
      sourceDebtName: string;
      amount: number;
      effectiveMonth: string;
      triggerPaymentId: string;
    } | null>(null);

  const [
    reallocationTarget,
    setReallocationTarget,
  ] =
    useState<ReallocationTarget>(
      "gold"
    );

  const [
    reallocationDebtId,
    setReallocationDebtId,
  ] = useState<number | null>(null);

  /* ==================================================
     MAAS MODALI
  ================================================== */

  const [salaryModalOpen, setSalaryModalOpen] =
    useState(false);

  const [salaryInput, setSalaryInput] =
    useState("");

  /* ==================================================
     ODEME MODALI
  ================================================== */

  const [paymentModalOpen, setPaymentModalOpen] =
    useState(false);

  const [selectedDebtId, setSelectedDebtId] =
    useState<number | null>(null);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState("2026-10-01");

  const [paymentMonth, setPaymentMonth] =
    useState("2026-10");

  /* ==================================================
     ODEME FILTRELERI
  ================================================== */

  const [
    paymentFilterMonth,
    setPaymentFilterMonth,
  ] = useState("all");

  const [
    paymentFilterDebt,
    setPaymentFilterDebt,
  ] = useState("all");

  /* ==================================================
     ALTIN MODALI
  ================================================== */

  const [goldModalOpen, setGoldModalOpen] =
    useState(false);

  const [goldDate, setGoldDate] =
    useState("2026-10-01");

  const [goldMonth, setGoldMonth] =
    useState("2026-10");

  const [goldGrams, setGoldGrams] =
    useState("");

  const [
    goldPricePerGram,
    setGoldPricePerGram,
  ] = useState("");

  const [goldNote, setGoldNote] =
    useState("");

  const [goldFilterMonth, setGoldFilterMonth] =
    useState("all");

  /* ==================================================
     LOCAL STORAGE
  ================================================== */

  useEffect(() => {
    localStorage.setItem(
      "butcem-salaries",
      JSON.stringify(salaryRecords)
    );
  }, [salaryRecords]);

  useEffect(() => {
    localStorage.setItem(
      "butcem-debts",
      JSON.stringify(debts)
    );
  }, [debts]);

  useEffect(() => {
    localStorage.setItem(
      "butcem-gold",
      JSON.stringify(goldPurchases)
    );
  }, [goldPurchases]);

  useEffect(() => {
    localStorage.setItem(
      "butcem-reallocations",
      JSON.stringify(reallocations)
    );
  }, [reallocations]);

  /* ==================================================
     TEMEL HESAPLAMALAR
  ================================================== */

  const currentSalary =
    salaryRecords[selectedMonth] ??
    salaryRecords["2026-10"] ??
    DEFAULT_SALARY;

  const totalDebt = debts.reduce(
    (sum, debt) =>
      sum + debt.balance,
    0
  );

  const allPayments = useMemo(() => {
    return debts
      .flatMap(
        (debt) =>
          debt.history || []
      )
      .sort(
        (a, b) =>
          new Date(
            b.date
          ).getTime() -
          new Date(
            a.date
          ).getTime()
      );
  }, [debts]);

  const filteredPayments =
    allPayments.filter(
      (payment) => {
        const monthOK =
          paymentFilterMonth ===
            "all" ||
          payment.month ===
            paymentFilterMonth;

        const debtOK =
          paymentFilterDebt ===
            "all" ||
          String(
            payment.debtId
          ) === paymentFilterDebt;

        return (
          monthOK && debtOK
        );
      }
    );

  const filteredPaymentTotal =
    filteredPayments.reduce(
      (sum, payment) =>
        sum + payment.amount,
      0
    );

  const totalGoldGrams =
    goldPurchases.reduce(
      (sum, purchase) =>
        sum + purchase.grams,
      0
    );

  const totalGoldCost =
    goldPurchases.reduce(
      (sum, purchase) =>
        sum + purchase.totalCost,
      0
    );

  const averageGoldPrice =
    totalGoldGrams > 0
      ? totalGoldCost /
        totalGoldGrams
      : 0;

  const selectedMonthGold =
    goldPurchases
      .filter(
        (purchase) =>
          purchase.month ===
          selectedMonth
      )
      .reduce(
        (sum, purchase) =>
          sum + purchase.grams,
        0
      );

  const selectedMonthGoldCost =
    goldPurchases
      .filter(
        (purchase) =>
          purchase.month ===
          selectedMonth
      )
      .reduce(
        (sum, purchase) =>
          sum + purchase.totalCost,
        0
      );

  const filteredGoldPurchases =
    goldPurchases
      .filter(
        (purchase) =>
          goldFilterMonth ===
            "all" ||
          purchase.month ===
            goldFilterMonth
      )
      .sort(
        (a, b) =>
          new Date(
            b.date
          ).getTime() -
          new Date(
            a.date
          ).getTime()
      );

  /* ==================================================
     BORÇ BU AY AKTİF Mİ?
  ================================================== */

  function debtIsActiveForMonth(
    debt: Debt,
    month: string
  ) {
    if (
      month <
      FIRST_PAYMENT_MONTH
    ) {
      return false;
    }

    if (
      debt.paidOffMonth &&
      month >
        debt.paidOffMonth
    ) {
      return false;
    }

    return true;
  }

  /* ==================================================
     BORCUN NORMAL AYLIK PLANI
  ================================================== */

  function baseDebtPlanForMonth(
    debt: Debt,
    month: string
  ) {
    if (
      !debtIsActiveForMonth(
        debt,
        month
      )
    ) {
      return 0;
    }

    return (
      NOVEMBER_DEBT_PLAN[
        debt.name
      ] ??
      debt.monthlyPayment
    );
  }

  /* ==================================================
     BORCUN GERÇEK AYLIK PLANI

     Burada daha önce başka borçtan
     gelen ekstra para da ekleniyor.
  ================================================== */

  function debtPlanForMonth(
    debt: Debt,
    month: string
  ) {
    const base =
      baseDebtPlanForMonth(
        debt,
        month
      );

    if (base === 0) {
      return 0;
    }

    const extra =
      reallocations
        .filter(
          (item) =>
            item.target ===
              "debt" &&
            item.targetDebtId ===
              debt.id &&
            item.effectiveMonth <=
              month &&
            debtIsActiveForMonth(
              debt,
              month
            )
        )
        .reduce(
          (sum, item) =>
            sum + item.amount,
          0
        );

    return base + extra;
  }

  /* ==================================================
     AYLIK PLANIN TAMAMI
  ================================================== */

  function getPlanForMonth(
    month: string
  ) {
    let gold =
      PLANNED_GOLD;

    let living =
      PLANNED_LIVING;

    let emergency =
      PLANNED_EMERGENCY;

    let debtTotal = 0;

    /* Altına giden ek paralar */
    gold += reallocations
      .filter(
        (item) =>
          item.target ===
            "gold" &&
          item.effectiveMonth <=
            month
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    /* Yaşam / Kişisel */
    living += reallocations
      .filter(
        (item) =>
          item.target ===
            "living" &&
          item.effectiveMonth <=
            month
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    /* Acil birikim */
    emergency += reallocations
      .filter(
        (item) =>
          item.target ===
            "emergency" &&
          item.effectiveMonth <=
            month
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    /* Borçlar */
    if (
      month >=
      FIRST_PAYMENT_MONTH
    ) {
      debts.forEach((debt) => {
        debtTotal +=
          debtPlanForMonth(
            debt,
            month
          );
      });
    }

    /* Dağıtılmamış */
    const total =
      gold +
      living +
      emergency +
      debtTotal;

    const unallocated =
      currentSalary - total;

    return {
      gold,
      living,
      emergency,
      debtTotal,
      unallocated,
      total,
    };
  }

  const currentPlan =
    getPlanForMonth(
      selectedMonth
    );

  /* ==================================================
     MAAS
  ================================================== */

  function openSalaryModal() {
    setSalaryInput(
      String(currentSalary)
    );

    setSalaryModalOpen(true);
  }

  function saveSalary() {
    const value = Number(
      salaryInput.replace(",", ".")
    );

    if (!value || value < 0) {
      alert(
        "Geçerli bir maaş gir."
      );

      return;
    }

    setSalaryRecords(
      (prev) => ({
        ...prev,
        [selectedMonth]:
          value,
      })
    );

    setSalaryModalOpen(false);
  }

  /* ==================================================
     ÖDEME EKLE
  ================================================== */

  function openPaymentModal(
    debtId: number
  ) {
    setSelectedDebtId(
      debtId
    );

    setPaymentAmount("");

    setPaymentMonth(
      selectedMonth
    );

    setPaymentDate(
      new Date()
        .toISOString()
        .slice(0, 10)
    );

    setPaymentModalOpen(true);
  }

  function addPayment() {
    if (
      selectedDebtId === null
    ) {
      return;
    }

    const amount = Number(
      paymentAmount.replace(
        ",",
        "."
      )
    );

    if (!amount || amount <= 0) {
      alert(
        "Geçerli bir ödeme tutarı gir."
      );

      return;
    }

    const debt = debts.find(
      (item) =>
        item.id ===
        selectedDebtId
    );

    if (!debt) {
      return;
    }

    if (
      amount >
      debt.balance
    ) {
      alert(
        "Ödeme tutarı kalan borçtan fazla olamaz."
      );

      return;
    }

    const payment: Payment = {
      id: crypto.randomUUID(),
      debtId:
        selectedDebtId,
      month:
        paymentMonth,
      amount,
      date:
        paymentDate,
    };

    /*
      ÖNEMLİ:

      Borç bitmeden hemen önceki aylık plan
      hesaplanıyor.

      Eğer borç tamamen biterse,
      bu aylık tutar gelecek ay
      serbest kalacak.
    */

    const freedMonthlyAmount =
      debtPlanForMonth(
        debt,
        paymentMonth
      );

    const newBalance =
      Math.max(
        debt.balance -
          amount,
        0
      );

    const debtFinished =
      newBalance === 0;

    setDebts((prev) =>
      prev.map((item) => {
        if (
          item.id !==
          selectedDebtId
        ) {
          return item;
        }

        return {
          ...item,

          balance:
            newBalance,

          history: [
            ...(item.history ||
              []),
            payment,
          ],

          ...(debtFinished
            ? {
                paidOffMonth:
                  paymentMonth,

                paidOffByPaymentId:
                  payment.id,
              }
            : {}),
        };
      })
    );

    setPaymentModalOpen(false);

    /*
      BORÇ TAMAMEN BİTTİYSE
      kullanıcıya soruyoruz.
    */

    if (
      debtFinished &&
      freedMonthlyAmount > 0
    ) {
      setPendingReallocation({
        sourceDebtId:
          debt.id,

        sourceDebtName:
          debt.name,

        amount:
          freedMonthlyAmount,

        effectiveMonth:
          nextMonth(
            paymentMonth
          ),

        triggerPaymentId:
          payment.id,
      });

      setReallocationTarget(
        "gold"
      );

      setReallocationDebtId(
        null
      );
    }
  }

  /* ==================================================
     BORÇ BİTTİKTEN SONRA HEDEFİ KAYDET
  ================================================== */

  function saveReallocation() {
    if (
      !pendingReallocation
    ) {
      return;
    }

    if (
      reallocationTarget ===
      "debt"
    ) {
      if (
        reallocationDebtId ===
        null
      ) {
        alert(
          "Lütfen aktarılacak borcu seç."
        );

        return;
      }

      if (
        reallocationDebtId ===
        pendingReallocation.sourceDebtId
      ) {
        alert(
          "Bitmiş borcun kendisini hedef olarak seçemezsin."
        );

        return;
      }
    }

    const newReallocation: Reallocation =
      {
        id: crypto.randomUUID(),

        sourceDebtId:
          pendingReallocation.sourceDebtId,

        sourceDebtName:
          pendingReallocation.sourceDebtName,

        amount:
          pendingReallocation.amount,

        effectiveMonth:
          pendingReallocation.effectiveMonth,

        target:
          reallocationTarget,

        targetDebtId:
          reallocationTarget ===
          "debt"
            ? reallocationDebtId ??
              undefined
            : undefined,

        triggerPaymentId:
          pendingReallocation.triggerPaymentId,
      };

    setReallocations(
      (prev) => [
        ...prev,
        newReallocation,
      ]
    );

    setPendingReallocation(
      null
    );

    setReallocationDebtId(
      null
    );
  }

  /* ==================================================
     ÖDEME SİL
  ================================================== */

  function deletePayment(
    payment: Payment
  ) {
    if (
      !window.confirm(
        `${money(
          payment.amount
        )} TL tutarındaki ödemeyi silmek istiyor musun?`
      )
    ) {
      return;
    }

    setDebts((prev) =>
      prev.map((debt) => {
        if (
          debt.id !==
          payment.debtId
        ) {
          return debt;
        }

        const wasPaidOffByThisPayment =
          debt.paidOffByPaymentId ===
          payment.id;

        return {
          ...debt,

          balance:
            debt.balance +
            payment.amount,

          history:
            debt.history.filter(
              (item) =>
                item.id !==
                payment.id
            ),

          ...(wasPaidOffByThisPayment
            ? {
                paidOffMonth:
                  undefined,

                paidOffByPaymentId:
                  undefined,
              }
            : {}),
        };
      })
    );

    /*
      Eğer bu ödeme borcu bitiren ödeme ise,
      ona bağlı aktarımı da geri alıyoruz.
    */

    setReallocations(
      (prev) =>
        prev.filter(
          (item) =>
            item.triggerPaymentId !==
            payment.id
        )
    );
  }

  /* ==================================================
     ALTIN
  ================================================== */

  function openGoldModal() {
    setGoldMonth(
      selectedMonth
    );

    setGoldDate(
      new Date()
        .toISOString()
        .slice(0, 10)
    );

    setGoldGrams("");

    setGoldPricePerGram("");

    setGoldNote("");

    setGoldModalOpen(true);
  }

  function addGoldPurchase() {
    const grams = Number(
      goldGrams.replace(
        ",",
        "."
      )
    );

    const pricePerGram =
      Number(
        goldPricePerGram.replace(
          ",",
          "."
        )
      );

    if (!grams || grams <= 0) {
      alert(
        "Geçerli bir gram miktarı gir."
      );

      return;
    }

    if (
      !pricePerGram ||
      pricePerGram <= 0
    ) {
      alert(
        "Geçerli bir gram alış fiyatı gir."
      );

      return;
    }

    const purchase: GoldPurchase =
      {
        id: crypto.randomUUID(),

        date:
          goldDate,

        month:
          goldMonth,

        grams,

        pricePerGram,

        totalCost:
          grams *
          pricePerGram,

        note:
          goldNote.trim() ||
          undefined,
      };

    setGoldPurchases(
      (prev) => [
        ...prev,
        purchase,
      ]
    );

    setGoldModalOpen(false);
  }

  function deleteGoldPurchase(
    purchase: GoldPurchase
  ) {
    if (
      !window.confirm(
        `${numberFormat(
          purchase.grams
        )} gram altın kaydını silmek istiyor musun?`
      )
    ) {
      return;
    }

    setGoldPurchases(
      (prev) =>
        prev.filter(
          (item) =>
            item.id !==
            purchase.id
        )
    );
  }

  /* ==================================================
     ANA SAYFA
  ================================================== */

  function renderHome() {
    return (
      <div className="page">
        <div className="header">
          <div>
            <div className="logo">
              Bütçem
            </div>

            <div className="subtitle">
              {monthLabel(
                selectedMonth
              )}
            </div>
          </div>

          <select
            value={
              selectedMonth
            }
            onChange={(e) =>
              setSelectedMonth(
                e.target.value
              )
            }
          >
            {availableMonths.map(
              (month) => (
                <option
                  key={month}
                  value={month}
                >
                  {monthLabel(
                    month
                  )}
                </option>
              )
            )}
          </select>
        </div>

        <div className="income-card">
          <div>
            <span>
              Bu Ayki Maaş
            </span>

            <strong>
              {money(
                currentSalary
              )}{" "}
              TL
            </strong>
          </div>

          <button
            onClick={
              openSalaryModal
            }
          >
            Düzenle
          </button>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>
              🪙 Altın
            </span>

            <strong>
              {money(
                currentPlan.gold
              )}{" "}
              TL
            </strong>

            <small>
              Gerçekleşen:{" "}
              {numberFormat(
                selectedMonthGold
              )}{" "}
              gr
            </small>
          </div>

          <div className="summary-card">
            <span>
              🏠 Yaşam
            </span>

            <strong>
              {money(
                currentPlan.living
              )}{" "}
              TL
            </strong>
          </div>

          <div className="summary-card">
            <span>
              🛟 Acil Birikim
            </span>

            <strong>
              {money(
                currentPlan.emergency
              )}{" "}
              TL
            </strong>
          </div>

          <div className="summary-card">
            <span>
              💳 Borç
            </span>

            <strong>
              {money(
                currentPlan.debtTotal
              )}{" "}
              TL
            </strong>
          </div>
        </div>

        <div className="plan-list">
          <h3>
            Aylık Plan
          </h3>

          <div className="plan-item">
            <span>
              🪙 Altın
            </span>

            <strong>
              {money(
                currentPlan.gold
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              🏠 Yaşam / Kişisel
            </span>

            <strong>
              {money(
                currentPlan.living
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              🛟 Acil Durum Birikimi
            </span>

            <strong>
              {money(
                currentPlan.emergency
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              💳 Borç Ödemeleri
            </span>

            <strong>
              {money(
                currentPlan.debtTotal
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              📦 Dağıtılmamış
            </span>

            <strong>
              {money(
                Math.max(
                  currentPlan.unallocated,
                  0
                )
              )}{" "}
              TL
            </strong>
          </div>
        </div>

        <div className="debt-total-card">
          <span>
            Toplam Kalan Borç
          </span>

          <strong>
            {money(
              totalDebt
            )}{" "}
            TL
          </strong>
        </div>
      </div>
    );
  }

  /* ==================================================
     BORÇLAR
  ================================================== */

  function renderDebts() {
    return (
      <div className="page">
        <div className="header">
          <div>
            <div className="logo">
              Borçlar
            </div>

            <div className="subtitle">
              {monthLabel(
                selectedMonth
              )}
            </div>
          </div>
        </div>

        <div className="debt-total-card">
          <span>
            Toplam Kalan Borç
          </span>

          <strong>
            {money(
              totalDebt
            )}{" "}
            TL
          </strong>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "center",
            marginBottom: 18,
          }}
        >
          <button
            className="payment-button"
            onClick={() =>
              setActiveTab(
                "payments"
              )
            }
          >
            Tüm Ödeme Geçmişi
          </button>
        </div>

        {debts.map((debt) => {
          const finished =
            debt.balance <= 0;

          const plan =
            debtPlanForMonth(
              debt,
              selectedMonth
            );

          const monthPaid =
            debt.history
              .filter(
                (payment) =>
                  payment.month ===
                  selectedMonth
              )
              .reduce(
                (
                  sum,
                  payment
                ) =>
                  sum +
                  payment.amount,
                0
              );

          return (
            <div
              className={`debt-card ${
                finished
                  ? "finished"
                  : ""
              }`}
              key={debt.id}
            >
              <div className="debt-header">
                <div>
                  <h3>
                    {debt.name}
                  </h3>

                  {finished ? (
                    <span className="finished">
                      BİTTİ 🎉
                    </span>
                  ) : (
                    <span>
                      Kalan:{" "}
                      <strong>
                        {money(
                          debt.balance
                        )}{" "}
                        TL
                      </strong>
                    </span>
                  )}
                </div>

                {!finished && (
                  <button
                    className="payment-button"
                    onClick={() =>
                      openPaymentModal(
                        debt.id
                      )
                    }
                  >
                    Ödeme Ekle
                  </button>
                )}
              </div>

              <div
                className="debt-info"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <span>
                    Bu Ay Plan
                  </span>

                  <strong>
                    {money(
                      plan
                    )}{" "}
                    TL
                  </strong>
                </div>

                <div>
                  <span>
                    Gerçekleşen
                  </span>

                  <strong>
                    {money(
                      monthPaid
                    )}{" "}
                    TL
                  </strong>
                </div>
              </div>

              {debt.history
                .length > 0 && (
                <div className="payment-history">
                  <h4>
                    Son Ödemeler
                  </h4>

                  {debt.history
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(
                          b.date
                        ).getTime() -
                        new Date(
                          a.date
                        ).getTime()
                    )
                    .slice(0, 3)
                    .map(
                      (
                        payment
                      ) => (
                        <div
                          className="payment-history-item"
                          key={
                            payment.id
                          }
                        >
                          <div>
                            <strong>
                              {money(
                                payment.amount
                              )}{" "}
                              TL
                            </strong>

                            <small>
                              {monthLabel(
                                payment.month
                              )}{" "}
                              •{" "}
                              {
                                payment.date
                              }
                            </small>
                          </div>

                          <button
                            onClick={() =>
                              deletePayment(
                                payment
                              )
                            }
                          >
                            Sil
                          </button>
                        </div>
                      )
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ==================================================
     ÖDEME GEÇMİŞİ
  ================================================== */

  function renderPayments() {
    return (
      <div className="page">
        <div className="header">
          <div>
            <div className="logo">
              Ödeme Geçmişi
            </div>

            <div className="subtitle">
              Gerçekleşen borç
              ödemeleri
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <select
            value={
              paymentFilterMonth
            }
            onChange={(e) =>
              setPaymentFilterMonth(
                e.target.value
              )
            }
          >
            <option value="all">
              Tüm Aylar
            </option>

            {availableMonths.map(
              (month) => (
                <option
                  key={month}
                  value={month}
                >
                  {monthLabel(
                    month
                  )}
                </option>
              )
            )}
          </select>

          <select
            value={
              paymentFilterDebt
            }
            onChange={(e) =>
              setPaymentFilterDebt(
                e.target.value
              )
            }
          >
            <option value="all">
              Tüm Borçlar
            </option>

            {debts.map((debt) => (
              <option
                key={debt.id}
                value={String(
                  debt.id
                )}
              >
                {debt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="debt-total-card">
          <span>
            Filtrelenen Toplam
          </span>

          <strong>
            {money(
              filteredPaymentTotal
            )}{" "}
            TL
          </strong>
        </div>

        {filteredPayments.length ===
        0 ? (
          <div className="empty-page">
            <h3>
              Henüz ödeme yok
            </h3>

            <p>
              Gerçekleşen borç
              ödemelerin burada
              görünecek.
            </p>
          </div>
        ) : (
          <div className="payment-history">
            {filteredPayments.map(
              (payment) => {
                const debt =
                  debts.find(
                    (item) =>
                      item.id ===
                      payment.debtId
                  );

                return (
                  <div
                    className="payment-history-item"
                    key={
                      payment.id
                    }
                  >
                    <div>
                      <strong>
                        {money(
                          payment.amount
                        )}{" "}
                        TL
                      </strong>

                      <small>
                        {debt?.name} •{" "}
                        {monthLabel(
                          payment.month
                        )}{" "}
                        •{" "}
                        {
                          payment.date
                        }
                      </small>
                    </div>

                    <button
                      onClick={() =>
                        deletePayment(
                          payment
                        )
                      }
                    >
                      Sil
                    </button>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    );
  }

  /* ==================================================
     PLAN
  ================================================== */

  function renderPlan() {
    return (
      <div className="page">
        <div className="header">
          <div>
            <div className="logo">
              Plan
            </div>

            <div className="subtitle">
              {monthLabel(
                selectedMonth
              )}
            </div>
          </div>
        </div>

        <div className="plan-list">
          <h3>
            {monthLabel(
              selectedMonth
            )}
          </h3>

          <div className="plan-item">
            <span>
              🪙 Altın
            </span>

            <strong>
              {money(
                currentPlan.gold
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              🏠 Yaşam / Kişisel
            </span>

            <strong>
              {money(
                currentPlan.living
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              🛟 Acil Durum Birikimi
            </span>

            <strong>
              {money(
                currentPlan.emergency
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              💳 Borç Ödemeleri
            </span>

            <strong>
              {money(
                currentPlan.debtTotal
              )}{" "}
              TL
            </strong>
          </div>

          <div className="plan-item">
            <span>
              📦 Dağıtılmamış
            </span>

            <strong>
              {money(
                Math.max(
                  currentPlan.unallocated,
                  0
                )
              )}{" "}
              TL
            </strong>
          </div>
        </div>

        <div className="debt-total-card">
          <span>
            Toplam Plan
          </span>

          <strong>
            {money(
              currentPlan.total
            )}{" "}
            TL
          </strong>
        </div>
      </div>
    );
  }

  /* ==================================================
     BİRİKİM / ALTIN
  ================================================== */

  function renderSavings() {
    return (
      <div className="page">
        <div className="header">
          <div>
            <div className="logo">
              Birikim
            </div>

            <div className="subtitle">
              Gerçekleşen
              birikimlerin
            </div>
          </div>
        </div>

        <div className="debt-total-card">
          <span>
            Toplam Altın
          </span>

          <strong>
            {numberFormat(
              totalGoldGrams
            )}{" "}
            gr
          </strong>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>
              🪙 Toplam Maliyet
            </span>

            <strong>
              {money(
                totalGoldCost
              )}{" "}
              TL
            </strong>
          </div>

          <div className="summary-card">
            <span>
              📊 Ortalama Gram
            </span>

            <strong>
              {averageGoldPrice
                ? `${money(
                    averageGoldPrice
                  )} TL`
                : "—"}
            </strong>
          </div>
        </div>

        <div
          className="plan-list"
          style={{
            marginTop: 18,
          }}
        >
          <h3>
            {monthLabel(
              selectedMonth
            )}{" "}
            — Altın
          </h3>

          <div className="plan-item">
            <span>
              Planlanan
            </span>

            <strong>
              1 gr
            </strong>
          </div>

          <div className="plan-item">
            <span>
              Gerçekleşen
            </span>

            <strong>
              {numberFormat(
                selectedMonthGold
              )}{" "}
              gr
            </strong>
          </div>

          <div className="plan-item">
            <span>
              Gerçekleşen Maliyet
            </span>

            <strong>
              {money(
                selectedMonthGoldCost
              )}{" "}
              TL
            </strong>
          </div>
        </div>

        <button
          className="payment-button"
          onClick={
            openGoldModal
          }
          style={{
            width: "100%",
            marginTop: 18,
            marginBottom: 18,
          }}
        >
          + Altın Alımı Ekle
        </button>

        <div
          style={{
            marginBottom: 16,
          }}
        >
          <select
            value={
              goldFilterMonth
            }
            onChange={(e) =>
              setGoldFilterMonth(
                e.target.value
              )
            }
            style={{
              width: "100%",
              boxSizing:
                "border-box",
            }}
          >
            <option value="all">
              Tüm Aylar
            </option>

            {availableMonths.map(
              (month) => (
                <option
                  key={month}
                  value={month}
                >
                  {monthLabel(
                    month
                  )}
                </option>
              )
            )}
          </select>
        </div>

        {filteredGoldPurchases.length ===
        0 ? (
          <div className="empty-page">
            <h3>
              Henüz altın alımı yok
            </h3>

            <p>
              Gerçekten altın
              aldığında buradan
              kendin
              ekleyebilirsin.
            </p>
          </div>
        ) : (
          <div className="payment-history">
            <h3>
              Altın Alım Geçmişi
            </h3>

            {filteredGoldPurchases.map(
              (purchase) => (
                <div
                  className="payment-history-item"
                  key={
                    purchase.id
                  }
                >
                  <div
                    style={{
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <strong>
                      {numberFormat(
                        purchase.grams
                      )}{" "}
                      gr
                    </strong>

                    <small>
                      {monthLabel(
                        purchase.month
                      )}{" "}
                      •{" "}
                      {purchase.date}
                      <br />
                      Gram:{" "}
                      {money(
                        purchase.pricePerGram
                      )}{" "}
                      TL • Toplam:{" "}
                      {money(
                        purchase.totalCost
                      )}{" "}
                      TL
                      {purchase.note
                        ? ` • ${purchase.note}`
                        : ""}
                    </small>
                  </div>

                  <button
                    onClick={() =>
                      deleteGoldPurchase(
                        purchase
                      )
                    }
                  >
                    Sil
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  /* ==================================================
     RAPORLAR
  ================================================== */

  function renderReports() {
    const totalPaid =
      allPayments.reduce(
        (sum, payment) =>
          sum + payment.amount,
        0
      );

    return (
      <div className="page">
        <div className="header">
          <div>
            <div className="logo">
              Raporlar
            </div>

            <div className="subtitle">
              Genel durum
            </div>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>
              💳 Kalan Borç
            </span>

            <strong>
              {money(
                totalDebt
              )}{" "}
              TL
            </strong>
          </div>

          <div className="summary-card">
            <span>
              💸 Toplam Ödeme
            </span>

            <strong>
              {money(
                totalPaid
              )}{" "}
              TL
            </strong>
          </div>

          <div className="summary-card">
            <span>
              🪙 Altın
            </span>

            <strong>
              {numberFormat(
                totalGoldGrams
              )}{" "}
              gr
            </strong>
          </div>

          <div className="summary-card">
            <span>
              💰 Altın Maliyeti
            </span>

            <strong>
              {money(
                totalGoldCost
              )}{" "}
              TL
            </strong>
          </div>
        </div>

        {/* AKTİF AKTARIMLAR */}

        {reallocations.length >
          0 && (
          <div
            className="plan-list"
            style={{
              marginTop: 18,
            }}
          >
            <h3>
              Aktif Para Aktarımları
            </h3>

            {reallocations.map(
              (item) => {
                let targetText =
                  "";

                if (
                  item.target ===
                  "gold"
                ) {
                  targetText =
                    "🪙 Altın";
                }

                if (
                  item.target ===
                  "living"
                ) {
                  targetText =
                    "🏠 Yaşam / Kişisel";
                }

                if (
                  item.target ===
                  "emergency"
                ) {
                  targetText =
                    "🛟 Acil Birikim";
                }

                if (
                  item.target ===
                  "unallocated"
                ) {
                  targetText =
                    "📦 Dağıtılmamış";
                }

                if (
                  item.target ===
                  "debt"
                ) {
                  const targetDebt =
                    debts.find(
                      (debt) =>
                        debt.id ===
                        item.targetDebtId
                    );

                  targetText =
                    `💳 ${
                      targetDebt?.name ??
                      "Borç"
                    }`;
                }

                return (
                  <div
                    className="plan-item"
                    key={
                      item.id
                    }
                  >
                    <span>
                      {item.sourceDebtName}{" "}
                      bitti →
                      <br />
                      {targetText}
                    </span>

                    <strong>
                      +{" "}
                      {money(
                        item.amount
                      )}{" "}
                      TL
                    </strong>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    );
  }

  /* ==================================================
     İÇERİK
  ================================================== */

  function renderContent() {
    switch (
      activeTab
    ) {
      case "debts":
        return renderDebts();

      case "payments":
        return renderPayments();

      case "plan":
        return renderPlan();

      case "savings":
        return renderSavings();

      case "reports":
        return renderReports();

      default:
        return renderHome();
    }
  }

  return (
    <div className="app">
      {renderContent()}

      {/* ==================================================
          ALT MENÜ
      ================================================== */}

      <div className="bottom-nav">
        <button
          className={
            activeTab ===
            "home"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "home"
            )
          }
        >
          <span>🏠</span>
          Ana Sayfa
        </button>

        <button
          className={
            activeTab ===
            "debts"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "debts"
            )
          }
        >
          <span>💳</span>
          Borçlar
        </button>

        <button
          className={
            activeTab ===
            "plan"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "plan"
            )
          }
        >
          <span>📋</span>
          Plan
        </button>

        <button
          className={
            activeTab ===
            "savings"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "savings"
            )
          }
        >
          <span>🪙</span>
          Birikim
        </button>

        <button
          className={
            activeTab ===
            "reports"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab(
              "reports"
            )
          }
        >
          <span>📊</span>
          Raporlar
        </button>
      </div>

      {/* ==================================================
          MAAS MODALI
      ================================================== */}

      {salaryModalOpen && (
        <div className="modal-backdrop">
          <div className="payment-modal">
            <h3>
              {monthLabel(
                selectedMonth
              )}{" "}
              Maaşını Düzenle
            </h3>

            <label>
              Maaş
            </label>

            <input
              type="number"
              value={
                salaryInput
              }
              onChange={(e) =>
                setSalaryInput(
                  e.target.value
                )
              }
            />

            <div className="modal-buttons">
              <button
                onClick={() =>
                  setSalaryModalOpen(
                    false
                  )
                }
              >
                Vazgeç
              </button>

              <button
                onClick={
                  saveSalary
                }
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          ÖDEME MODALI
      ================================================== */}

      {paymentModalOpen && (
        <div className="modal-backdrop">
          <div className="payment-modal">
            <h3>
              Ödeme Ekle
            </h3>

            <label>
              Ay
            </label>

            <select
              value={
                paymentMonth
              }
              onChange={(e) =>
                setPaymentMonth(
                  e.target.value
                )
              }
            >
              {availableMonths.map(
                (month) => (
                  <option
                    key={month}
                    value={month}
                  >
                    {monthLabel(
                      month
                    )}
                  </option>
                )
              )}
            </select>

            <label>
              Tarih
            </label>

            <input
              type="date"
              value={
                paymentDate
              }
              onChange={(e) =>
                setPaymentDate(
                  e.target.value
                )
              }
            />

            <label>
              Ödeme Tutarı
            </label>

            <input
              type="number"
              value={
                paymentAmount
              }
              onChange={(e) =>
                setPaymentAmount(
                  e.target.value
                )
              }
              placeholder="1500"
            />

            <div className="modal-buttons">
              <button
                onClick={() =>
                  setPaymentModalOpen(
                    false
                  )
                }
              >
                Vazgeç
              </button>

              <button
                onClick={
                  addPayment
                }
              >
                Ödemeyi Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          ALTIN MODALI
      ================================================== */}

      {goldModalOpen && (
        <div className="modal-backdrop">
          <div className="payment-modal">
            <h3>
              🪙 Altın Alımı Ekle
            </h3>

            <label>
              Ay
            </label>

            <select
              value={
                goldMonth
              }
              onChange={(e) =>
                setGoldMonth(
                  e.target.value
                )
              }
            >
              {availableMonths.map(
                (month) => (
                  <option
                    key={month}
                    value={month}
                  >
                    {monthLabel(
                      month
                    )}
                  </option>
                )
              )}
            </select>

            <label>
              Alım Tarihi
            </label>

            <input
              type="date"
              value={
                goldDate
              }
              onChange={(e) =>
                setGoldDate(
                  e.target.value
                )
              }
            />

            <label>
              Altın Miktarı (gram)
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={
                goldGrams
              }
              onChange={(e) =>
                setGoldGrams(
                  e.target.value
                )
              }
              placeholder="1"
            />

            <label>
              Gram Alış Fiyatı (TL)
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={
                goldPricePerGram
              }
              onChange={(e) =>
                setGoldPricePerGram(
                  e.target.value
                )
              }
              placeholder="6700"
            />

            {Number(
              goldGrams
            ) > 0 &&
              Number(
                goldPricePerGram
              ) > 0 && (
                <div
                  style={{
                    margin:
                      "10px 0",
                    padding: 12,
                    borderRadius: 12,
                    background:
                      "rgba(255,255,255,.65)",
                  }}
                >
                  Toplam:{" "}
                  <strong>
                    {money(
                      Number(
                        goldGrams
                      ) *
                        Number(
                          goldPricePerGram
                        )
                    )}{" "}
                    TL
                  </strong>
                </div>
              )}

            <label>
              Not
            </label>

            <input
              type="text"
              value={
                goldNote
              }
              onChange={(e) =>
                setGoldNote(
                  e.target.value
                )
              }
              placeholder="Örneğin: Maaş sonrası aldım"
            />

            <div className="modal-buttons">
              <button
                onClick={() =>
                  setGoldModalOpen(
                    false
                  )
                }
              >
                Vazgeç
              </button>

              <button
                onClick={
                  addGoldPurchase
                }
              >
                Altını Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          YENİ:
          BORÇ BİTİNCE PARA AKTARMA MODALI
      ================================================== */}

      {pendingReallocation && (
        <div className="modal-backdrop">
          <div className="payment-modal">
            <h3>
              🎉 Borç Tamamen Bitti!
            </h3>

            <p
              style={{
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              <strong>
                {
                  pendingReallocation.sourceDebtName
                }
              </strong>{" "}
              tamamen ödendi.
            </p>

            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background:
                  "rgba(255,255,255,.65)",
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  marginBottom: 5,
                }}
              >
                Gelecek aydan itibaren
                serbest kalan aylık
                tutar:
              </div>

              <strong
                style={{
                  fontSize: 24,
                }}
              >
                {money(
                  pendingReallocation.amount
                )}{" "}
                TL
              </strong>

              <div
                style={{
                  fontSize: 13,
                  marginTop: 5,
                }}
              >
                Başlangıç:{" "}
                {
                  monthLabel(
                    pendingReallocation.effectiveMonth
                  )
                }
              </div>
            </div>

            <label>
              Bu tutarı nereye aktarmak
              istiyorsun?
            </label>

            <select
              value={
                reallocationTarget
              }
              onChange={(e) => {
                const value =
                  e.target
                    .value as ReallocationTarget;

                setReallocationTarget(
                  value
                );

                if (
                  value !==
                  "debt"
                ) {
                  setReallocationDebtId(
                    null
                  );
                }
              }}
            >
              <option value="gold">
                🪙 Altına aktar
              </option>

              <option value="living">
                🏠 Yaşam / Kişisel'e aktar
              </option>

              <option value="emergency">
                🛟 Acil Birikim'e aktar
              </option>

              <option value="debt">
                💳 Başka bir borca aktar
              </option>

              <option value="unallocated">
                📦 Dağıtılmamış bırak
              </option>
            </select>

            {reallocationTarget ===
              "debt" && (
              <>
                <label
                  style={{
                    marginTop: 12,
                  }}
                >
                  Hangi borca?
                </label>

                <select
                  value={
                    reallocationDebtId ??
                    ""
                  }
                  onChange={(e) =>
                    setReallocationDebtId(
                      e.target
                        .value
                        ? Number(
                            e.target
                              .value
                          )
                        : null
                    )
                  }
                >
                  <option value="">
                    Borç seç
                  </option>

                  {debts
                    .filter(
                      (debt) =>
                        debt.id !==
                          pendingReallocation.sourceDebtId &&
                        debt.balance >
                          0
                    )
                    .map(
                      (debt) => (
                        <option
                          key={
                            debt.id
                          }
                          value={String(
                            debt.id
                          )}
                        >
                          {
                            debt.name
                          }
                        </option>
                      )
                    )}
                </select>
              </>
            )}

            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                background:
                  "rgba(255,255,255,.5)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {reallocationTarget ===
                "gold" && (
                <>
                  🪙 Altın planına{" "}
                  <strong>
                    +{" "}
                    {money(
                      pendingReallocation.amount
                    )}{" "}
                    TL
                  </strong>{" "}
                  eklenecek.
                </>
              )}

              {reallocationTarget ===
                "living" && (
                <>
                  🏠 Yaşam / Kişisel
                  planına{" "}
                  <strong>
                    +{" "}
                    {money(
                      pendingReallocation.amount
                    )}{" "}
                    TL
                  </strong>{" "}
                  eklenecek.
                </>
              )}

              {reallocationTarget ===
                "emergency" && (
                <>
                  🛟 Acil Birikim
                  planına{" "}
                  <strong>
                    +{" "}
                    {money(
                      pendingReallocation.amount
                    )}{" "}
                    TL
                  </strong>{" "}
                  eklenecek.
                </>
              )}

              {reallocationTarget ===
                "debt" && (
                <>
                  💳 Seçtiğin borcun
                  aylık ödeme planına{" "}
                  <strong>
                    +{" "}
                    {money(
                      pendingReallocation.amount
                    )}{" "}
                    TL
                  </strong>{" "}
                  eklenecek.
                </>
              )}

              {reallocationTarget ===
                "unallocated" && (
                <>
                  📦 Tutar dağıtılmadan
                  bırakılacak ve
                  bütçede{" "}
                  <strong>
                    Dağıtılmamış
                  </strong>{" "}
                  olarak görünecek.
                </>
              )}
            </div>

            <div
              className="modal-buttons"
              style={{
                marginTop: 18,
              }}
            >
              <button
                onClick={() =>
                  setPendingReallocation(
                    null
                  )
                }
              >
                Şimdilik Geç
              </button>

              <button
                onClick={
                  saveReallocation
                }
              >
                Aktarımı Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;