package com.springbench.insurance.persistence;

import com.springbench.insurance.domain.enums.DemographicsStatus;
import com.springbench.insurance.domain.model.Demographics;
import com.springbench.insurance.domain.model.Member;
import com.springbench.insurance.persistence.service.CoreServices;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * PERSIST-06: sustained concurrent writes must not surface SQLITE_BUSY (DoD #6).
 * Mirrors production write-safety: WAL pragmas + Hikari pool size 1.
 */
class ConcurrentWriteLoadTest {
    private static final int THREAD_COUNT = 32;
    private static final int WRITES_PER_THREAD = 25;

    private Path dbFile;
    private HikariDataSource dataSource;

    @AfterEach
    void tearDown() {
        if (dataSource != null) {
            dataSource.close();
        }
        if (dbFile != null) {
            try {
                Files.deleteIfExists(dbFile);
                Files.deleteIfExists(Paths.get(dbFile + "-wal"));
                Files.deleteIfExists(Paths.get(dbFile + "-shm"));
            } catch (Exception ignored) {
                // best-effort temp cleanup
            }
        }
    }

    @Test
    void concurrentMemberCreatesProduceZeroSqliteBusy() throws Exception {
        dbFile = SqliteTestSupport.tempDbFile();
        dataSource = SqliteTestSupport.createWritePool(dbFile);
        CoreServices services = new CoreServices(dataSource);

        AtomicInteger busyErrors = new AtomicInteger();
        AtomicInteger successCount = new AtomicInteger();
        CountDownLatch startGate = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(THREAD_COUNT);

        List<Future<?>> futures = new ArrayList<Future<?>>();
        for (int t = 0; t < THREAD_COUNT; t++) {
            final int threadId = t;
            futures.add(executor.submit(() -> {
                startGate.await();
                for (int i = 0; i < WRITES_PER_THREAD; i++) {
                    try {
                        Demographics demographics = sampleDemographics(threadId, i);
                        Member member = services.members.createMember(demographics, null, "load-test");
                        if (member != null && member.getId() != null) {
                            successCount.incrementAndGet();
                        }
                    } catch (RuntimeException ex) {
                        if (isSqliteBusy(ex)) {
                            busyErrors.incrementAndGet();
                        } else {
                            throw ex;
                        }
                    }
                }
                return null;
            }));
        }

        startGate.countDown();
        for (Future<?> future : futures) {
            future.get(2, TimeUnit.MINUTES);
        }
        executor.shutdown();
        assertTrue(executor.awaitTermination(30, TimeUnit.SECONDS));

        assertEquals(0, busyErrors.get(), "SQLITE_BUSY must not occur under concurrent writes");
        assertEquals(THREAD_COUNT * WRITES_PER_THREAD, successCount.get());
    }

    private static Demographics sampleDemographics(int threadId, int index) {
        Demographics demographics = new Demographics();
        demographics.setFname("Load");
        demographics.setLname("Thread" + threadId);
        demographics.setEmail("t" + threadId + "-" + index + "@bench.test");
        demographics.setPhoneNumber("555-0100");
        demographics.setStatus(DemographicsStatus.ALIVE);
        return demographics;
    }

    private static boolean isSqliteBusy(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof SQLException) {
                SQLException sql = (SQLException) current;
                if (sql.getErrorCode() == 5) {
                    return true;
                }
                String message = sql.getMessage();
                if (message != null && message.toUpperCase().contains("SQLITE_BUSY")) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }
}
